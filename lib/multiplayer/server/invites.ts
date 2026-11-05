import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { serverBroadcast } from "@/lib/realtime/server";
import { pushTo } from "@/lib/push/server";
import { GAME_BY_ID } from "@/lib/catalog";
import { friendshipBetween, isBlockedPair } from "@/lib/social/server";
import type { InviteKind } from "../types";

/**
 * Inviting a friend you already have into a game you opened: a Duel challenge waiting for its rival, a Party room
 * you're in, or a Board Games invite. The friend gets a card wherever they are in the app (user:<id> channel,
 * components/shell/Inbox.tsx) with a button to join. Only accepted friends, never across a block, and only into a
 * game that is yours and still open. The join itself still goes through that game's own checks.
 */
export async function sendGameInvite(
  admin: SupabaseClient,
  me: string,
  input: { to: string; kind: InviteKind; target: string },
): Promise<{ sent: true }> {
  if (input.to === me) throw new ApiError(400, "self");
  const f = await friendshipBetween(admin, me, input.to);
  if (!f || f.status !== "accepted") throw new ApiError(403, "not_friends", "You can only invite your friends.");
  if (await isBlockedPair(admin, me, input.to)) throw new ApiError(403, "blocked");

  let href: string;
  let game: string | null = null;
  if (input.kind === "duel") {
    const { data: m } = await admin.from("matches").select("id, code, status, host_id, kind, game_id").eq("id", input.target).maybeSingle();
    if (!m || m.kind !== "duel" || m.host_id !== me || m.status !== "lobby" || !m.code) throw new ApiError(409, "invite_closed");
    href = `/duel?code=${m.code}`;
    game = m.game_id as string | null;
  } else if (input.kind === "party") {
    const { data: m } = await admin
      .from("matches")
      .select("id, code, status, kind, game_id")
      .eq("code", input.target)
      .eq("kind", "race")
      .maybeSingle();
    if (!m || m.status === "finished" || !m.code) throw new ApiError(409, "invite_closed");
    const { data: inRoom } = await admin
      .from("match_players")
      .select("player_id")
      .eq("match_id", m.id)
      .eq("player_id", me)
      .is("left_at", null)
      .maybeSingle();
    if (!inRoom) throw new ApiError(403, "not_in_room");
    href = `/party/${m.code}`;
    game = m.game_id as string | null;
  } else {
    const { data: b } = await admin
      .from("board_matches")
      .select("id, status, players, invite_code, game_id")
      .eq("id", input.target)
      .maybeSingle();
    if (!b || b.status !== "waiting" || !b.invite_code || !(b.players as string[]).includes(me)) throw new ApiError(409, "invite_closed");
    href = `/bay/${b.id}?join=${b.invite_code}`;
    game = b.game_id as string;
  }

  const { data: card } = await admin.from("players").select("nickname, avatar_color").eq("id", me).single();
  await serverBroadcast(`user:${input.to}`, "invite", {
    id: randomUUID(),
    from: { nickname: card?.nickname ?? "A friend", color: card?.avatar_color ?? "#B8F23A" },
    kind: input.kind,
    game,
    href,
  });
  const who = card?.nickname ?? "A friend";
  const what =
    input.kind === "duel"
      ? "a Duel"
      : input.kind === "party"
        ? "a Party Race"
        : `a game of ${GAME_BY_ID[game ?? ""]?.name ?? "a board game"}`;
  await pushTo(admin, input.to, { title: `${who} invited you`, body: `Join ${what} on SPUZL.`, url: href, tag: `invite:${href}` });
  return { sent: true };
}
