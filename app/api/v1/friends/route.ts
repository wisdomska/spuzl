import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { blockedIds, cards, friendshipBetween } from "@/lib/social/server";
import { canRequestByUsername, isUnder16, presenceFor } from "@/lib/social";

export const dynamic = "force-dynamic";

/** GET /api/v1/friends: accepted friends with presence, incoming and outgoing requests. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { data: rows, error } = await admin
    .from("friendships")
    .select("player_id, friend_id, status, created_at")
    .or(`player_id.eq.${player.id},friend_id.eq.${player.id}`);
  if (error) throw error;
  const blocked = await blockedIds(admin, player.id);
  const other = (r: { player_id: string; friend_id: string }) => (r.player_id === player.id ? r.friend_id : r.player_id);
  const visible = (rows ?? []).filter((r) => !blocked.has(other(r)));
  const people = await cards(admin, visible.map(other));
  const incomingIds = visible.filter((r) => r.status === "pending" && r.friend_id === player.id).map((r) => r.player_id);
  const { data: mutual } = incomingIds.length
    ? await admin.rpc("svc_mutual_counts", { p: player.id, others: incomingIds })
    : { data: [] as { other: string; n: number }[] };
  const mutualBy = new Map((mutual ?? []).map((m: { other: string; n: number }) => [m.other, m.n]));
  const now = Date.now();

  const friends = visible
    .filter((r) => r.status === "accepted")
    .map((r) => people.get(other(r)))
    .filter((c) => !!c)
    .map((c) => {
      const hidden = c.raw.hide_activity;
      const presence = hidden ? { online: false, label: "Activity hidden" } : presenceFor(c.raw.last_seen_at, c.raw.playing_game, now);
      const { raw: _raw, ...card } = c;
      void _raw;
      return { ...card, presence };
    })
    .sort((a, b) => Number(b.presence.online) - Number(a.presence.online) || a.nickname.localeCompare(b.nickname));

  const strip = (id: string) => {
    const c = people.get(id);
    if (!c) return null;
    const { raw: _raw, ...card } = c;
    void _raw;
    return card;
  };
  const incoming = incomingIds
    .map((id) => {
      const c = strip(id);
      return c && { ...c, mutual: mutualBy.get(id) ?? 0 };
    })
    .filter((x) => !!x);
  const outgoing = visible
    .filter((r) => r.status === "pending" && r.player_id === player.id)
    .map((r) => strip(r.friend_id))
    .filter((x) => !!x);

  return ok({ friends, incoming, outgoing, online: friends.filter((f) => f.presence.online).length });
});

const Request_ = z.object({ nickname: z.string().trim().min(3).max(16) });

/** POST /api/v1/friends: send a request by username. If they already asked you, you become friends. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `friend-req:${player.id}`, 30, 3600);
  const { nickname } = await body(req, Request_);
  if (isUnder16(player.age_band)) throw new ApiError(403, "invite_only", "Under-16 players add friends by invite link or QR.");
  const { data: target } = await admin
    .from("players")
    .select("id, age_band, banned_at, is_test")
    .ilike("nickname", nickname.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (!target || target.banned_at) throw new ApiError(404, "not_found", "No Spuzler with that name.");
  if (target.id === player.id) throw new ApiError(400, "self", "That's you.");
  if (!canRequestByUsername(player.age_band, target.age_band))
    throw new ApiError(403, "invite_only", "Under-16 players add friends by invite link or QR.");
  const blocked = await blockedIds(admin, player.id);
  // Same answer as "not found", so a block is never revealed.
  if (blocked.has(target.id)) throw new ApiError(404, "not_found", "No Spuzler with that name.");
  const existing = await friendshipBetween(admin, player.id, target.id);
  if (existing?.status === "accepted") return ok({ status: "friends" });
  if (existing && existing.player_id === target.id) {
    await admin.from("friendships").update({ status: "accepted" }).eq("player_id", target.id).eq("friend_id", player.id);
    return ok({ status: "friends" });
  }
  if (existing) return ok({ status: "requested" });
  const { error } = await admin.from("friendships").insert({ player_id: player.id, friend_id: target.id, status: "pending" });
  if (error && error.code !== "23505") throw error;
  return ok({ status: "requested" });
});
