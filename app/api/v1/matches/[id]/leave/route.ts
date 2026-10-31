import { handle, ok, requirePlayer } from "@/lib/api/server";
import { leave } from "@/lib/multiplayer/server/match";

/** POST /api/v1/matches/:id/leave: leave a room or a Duel. Leaving a live Duel counts as a loss. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/matches/[id]/leave">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  return ok(await leave(admin, id, player.id));
});
