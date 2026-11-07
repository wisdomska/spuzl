import { handle, ok, requirePlayer } from "@/lib/api/server";
import { loadMatch, member, touch, viewOf } from "@/lib/multiplayer/server/match";
import { isTurnRoom, modeOf, requirePartyMode } from "@/lib/multiplayer/server/adult";

/** GET /api/v1/matches/:id: the match as this player sees it (no solutions, no opponent boards, no secret words). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/matches/[id]">) => {
  const { id } = await ctx.params;
  const { admin, user, player } = await requirePlayer();
  const l = await loadMatch(admin, id);
  member(l, player.id);
  // Turn-based party rooms: their age gate on every read (switching the setting off or a moderator block ends access).
  if (isTurnRoom(l.m)) await requirePartyMode(admin, user, player, modeOf(l.m));
  await touch(admin, l, player.id);
  // Once the player is in a match their queue entry is spent.
  if (l.m.kind === "duel") await admin.from("matchmaking_queue").delete().eq("player_id", player.id).eq("match_id", id);
  return ok(await viewOf(admin, l, player.id));
});
