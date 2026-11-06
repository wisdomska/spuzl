import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { friendshipBetween, isBlockedPair } from "@/lib/social/server";
import { joinRequestsCopy } from "@/lib/copy/join-requests";
import { hostIsUnder16, joinAccess, MAX_PENDING_PER_ROOM, type JoinRequestStatus } from "../joinRules";
import { roomExpired } from "../roomCode";
import { matchTopic } from "./match";

/**
 * R2-13: friends-only rooms for under-16 hosts (admin setting "rooms.under16FriendsOnly"), and requests to join
 * them (table room_join_requests, which doubles as the admin join-approval log). The join endpoints
 * (/api/v1/rooms/:code/join and /api/v1/duel/friend/join) call `requireMayJoin`; everything here runs with the
 * service role and checks who is asking.
 */

/** The realtime event on the room's match channel when a request arrives or changes (no names in it). */
export const JOIN_REQUEST_EVENT = "join_request";

type Room = { id: string; kind: "duel" | "race"; status: string; host_id: string | null; code: string | null; emptied_at: string | null };
type RequestRow = {
  id: string;
  match_id: string | null;
  room_kind: "duel" | "party";
  room_code: string;
  host_id: string;
  requester_id: string;
  status: JoinRequestStatus;
  created_at: string;
  decided_at: string | null;
};

const friendsOnlyRefusal = () => new ApiError(403, "friends_only", joinRequestsCopy.friendsOnly);

/** True when the setting is on and this room's current host is under 16 (effective band). */
export async function friendsOnlyHost(admin: SupabaseClient, hostId: string | null): Promise<boolean> {
  if (!hostId) return false;
  if (!(await getGameSettings())["rooms.under16FriendsOnly"]) return false;
  const { data: host, error } = await admin.from("players").select("age_band, birth_year, birth_month").eq("id", hostId).maybeSingle();
  if (error) throw error;
  return !!host && hostIsUnder16(host);
}

async function approvedFor(admin: SupabaseClient, matchId: string, playerId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("room_join_requests")
    .select("id")
    .eq("match_id", matchId)
    .eq("requester_id", playerId)
    .eq("status", "approved")
    .limit(1);
  // Deployed ahead of migration 20261130101301: nobody has been approved yet (friends still join; the rest wait).
  if (error?.code === "42P01") return false;
  if (error) throw error;
  return !!data?.length;
}

/** Whether this player may join this room by code now; `wasMember`: they already hold a seat (a rejoin). */
export async function mayJoin(
  admin: SupabaseClient,
  room: { id: string; host_id: string | null },
  playerId: string,
  wasMember = false,
): Promise<boolean> {
  const isHost = room.host_id === playerId;
  if (isHost || wasMember) return true;
  const friendsOnly = await friendsOnlyHost(admin, room.host_id);
  if (!friendsOnly) return true;
  const host = room.host_id!;
  const [friendship, blocked, approved] = await Promise.all([
    friendshipBetween(admin, host, playerId),
    isBlockedPair(admin, host, playerId),
    approvedFor(admin, room.id, playerId),
  ]);
  return joinAccess({ friendsOnly, isHost, wasMember, friends: friendship?.status === "accepted", blocked, approved }) === "join";
}

/** The join endpoints' gate: 403 friends_only (with the player-facing reason) unless `mayJoin`. */
export async function requireMayJoin(
  admin: SupabaseClient,
  room: { id: string; host_id: string | null },
  playerId: string,
  wasMember = false,
) {
  if (!(await mayJoin(admin, room, playerId, wasMember))) throw friendsOnlyRefusal();
}

/** An open room for a code: a friend duel waiting for its rival, or a Party room that hasn't expired. */
async function openRoom(admin: SupabaseClient, code: string): Promise<Room> {
  const { data, error } = await admin.from("matches").select("id, kind, status, host_id, code, emptied_at").eq("code", code).maybeSingle();
  if (error) throw error;
  const m = data as Room | null;
  if (!m || (m.kind === "duel" && m.status !== "lobby") || (m.kind === "race" && roomExpired(m.emptied_at)))
    throw new ApiError(404, "room_not_found", joinRequestsCopy.gone);
  return m;
}

async function nicknameOf(admin: SupabaseClient, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await admin.from("players").select("nickname").eq("id", id).maybeSingle();
  return (data?.nickname as string | undefined) ?? null;
}

export type CreateResult =
  { status: "not_needed"; host: string | null } | { id: string; status: "pending" | "approved"; host: string | null };

/**
 * Asks to join a friends-only room by its code. Idempotent: a pending or approved request comes back as it is.
 * Refusals: 403 friends_only (a blocked pair; no request is made), 403 declined (the host already said no to this
 * room), 409 race_running, 429 too_many (the room has MAX_PENDING_PER_ROOM waiting). `not_needed` when the player
 * may simply join.
 */
export async function createJoinRequest(admin: SupabaseClient, playerId: string, code: string): Promise<CreateResult> {
  const room = await openRoom(admin, code);
  const host = await nicknameOf(admin, room.host_id);
  const { data: seat } = await admin
    .from("match_players")
    .select("left_at, kicked_at")
    .eq("match_id", room.id)
    .eq("player_id", playerId)
    .maybeSingle();
  if (seat?.kicked_at) throw new ApiError(403, "kicked", "The host removed you from this room.");
  if (room.host_id === playerId || seat || !(await friendsOnlyHost(admin, room.host_id))) return { status: "not_needed", host };
  if (room.kind === "race" && room.status !== "lobby")
    throw new ApiError(409, "race_running", "This race already started. Catch the next one.");
  const hostId = room.host_id!;
  const [friendship, blocked] = await Promise.all([friendshipBetween(admin, hostId, playerId), isBlockedPair(admin, hostId, playerId)]);
  if (blocked) throw friendsOnlyRefusal();
  if (friendship?.status === "accepted") return { status: "not_needed", host };

  const { data: last, error: e1 } = await admin
    .from("room_join_requests")
    .select("id, status")
    .eq("match_id", room.id)
    .eq("requester_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (last?.status === "pending" || last?.status === "approved") return { id: last.id as string, status: last.status, host };
  if (last?.status === "declined") throw new ApiError(403, "declined", joinRequestsCopy.declined);

  const { count, error: e2 } = await admin
    .from("room_join_requests")
    .select("id", { count: "exact", head: true })
    .eq("match_id", room.id)
    .eq("status", "pending");
  if (e2) throw e2;
  if ((count ?? 0) >= MAX_PENDING_PER_ROOM) throw new ApiError(429, "too_many", joinRequestsCopy.tooMany);

  const { data: row, error: e3 } = await admin
    .from("room_join_requests")
    .insert({
      match_id: room.id,
      room_kind: room.kind === "duel" ? "duel" : "party",
      room_code: code,
      host_id: hostId,
      requester_id: playerId,
    })
    .select("id")
    .single();
  // Two taps at once: the unique pending index keeps one; hand back that one.
  if (e3?.code === "23505") return createJoinRequest(admin, playerId, code);
  if (e3) throw e3;
  await serverBroadcast(matchTopic(room.id), JOIN_REQUEST_EVENT, {});
  return { id: row.id as string, status: "pending", host };
}

async function requestRow(admin: SupabaseClient, id: string): Promise<RequestRow> {
  const { data, error } = await admin
    .from("room_join_requests")
    .select("id, match_id, room_kind, room_code, host_id, requester_id, status, created_at, decided_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "not_found");
  return data as RequestRow;
}

/** The requester's own request (status, room). 404 for anyone else, so ids reveal nothing. */
export async function myJoinRequest(admin: SupabaseClient, playerId: string, id: string) {
  const r = await requestRow(admin, id);
  if (r.requester_id !== playerId) throw new ApiError(404, "not_found");
  return { id: r.id, status: r.status, kind: r.room_kind, code: r.room_code, host: await nicknameOf(admin, r.host_id) };
}

/** The requester takes their pending request back. */
export async function cancelJoinRequest(admin: SupabaseClient, playerId: string, id: string) {
  const r = await requestRow(admin, id);
  if (r.requester_id !== playerId) throw new ApiError(404, "not_found");
  if (r.status !== "pending") return { status: r.status };
  await admin
    .from("room_join_requests")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (r.match_id) await serverBroadcast(matchTopic(r.match_id), JOIN_REQUEST_EVENT, {});
  return { status: "cancelled" as const };
}

async function hostedRoom(admin: SupabaseClient, matchId: string, hostId: string) {
  const { data, error } = await admin.from("matches").select("id, host_id").eq("id", matchId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "not_found");
  if (data.host_id !== hostId) throw new ApiError(403, "host_only");
  return data as { id: string; host_id: string };
}

/** The host's pending requests for their room, oldest first, with each asker's nickname and colour. */
export async function pendingForHost(admin: SupabaseClient, hostId: string, matchId: string) {
  await hostedRoom(admin, matchId, hostId);
  const { data, error } = await admin
    .from("room_join_requests")
    .select("id, requester_id, created_at")
    .eq("match_id", matchId)
    .eq("status", "pending")
    .order("created_at")
    .limit(MAX_PENDING_PER_ROOM);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.requester_id as string);
  const { data: players } = ids.length
    ? await admin.from("players").select("id, nickname, avatar_color").in("id", ids)
    : { data: [] as { id: string; nickname: string; avatar_color: string }[] };
  const byId = new Map((players ?? []).map((p) => [p.id as string, p]));
  return {
    requests: rows.map((r) => ({
      id: r.id as string,
      nickname: (byId.get(r.requester_id)?.nickname as string | undefined) ?? "Spuzler",
      color: (byId.get(r.requester_id)?.avatar_color as string | undefined) ?? null,
      at: Date.parse(r.created_at as string),
    })),
  };
}

/** The host answers a pending request for the room they host now. Approving lets that player join by code. */
export async function decideJoinRequest(admin: SupabaseClient, hostId: string, id: string, decision: "approve" | "decline") {
  const r = await requestRow(admin, id);
  if (!r.match_id) throw new ApiError(404, "room_not_found", joinRequestsCopy.gone);
  await hostedRoom(admin, r.match_id, hostId);
  if (r.status !== "pending") return { status: r.status };
  const status: JoinRequestStatus = decision === "approve" ? "approved" : "declined";
  const { data, error } = await admin
    .from("room_join_requests")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("status");
  if (error) throw error;
  await serverBroadcast(matchTopic(r.match_id), JOIN_REQUEST_EVENT, {});
  return { status: (data?.[0]?.status as JoinRequestStatus | undefined) ?? (await requestRow(admin, id)).status };
}

/** For a Party room preview: whether this player must ask first, and their latest request for it. */
export async function joinStateFor(
  admin: SupabaseClient,
  room: { id: string; host_id: string | null },
  playerId: string,
  wasMember = false,
) {
  if (await mayJoin(admin, room, playerId, wasMember)) return { friendsOnly: false, request: null };
  const { data } = await admin
    .from("room_join_requests")
    .select("id, status")
    .eq("match_id", room.id)
    .eq("requester_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { friendsOnly: true, request: data ? { id: data.id as string, status: data.status as JoinRequestStatus } : null };
}
