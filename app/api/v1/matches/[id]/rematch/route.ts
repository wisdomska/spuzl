import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { rematch } from "@/lib/multiplayer/server/lobby";

/** POST /api/v1/matches/:id/rematch: ask for a rematch; it starts when both players ask. */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/matches/[id]/rematch">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `rematch:${player.id}`, 20, 60);
  return ok(await rematch(admin, id, player.id));
});
