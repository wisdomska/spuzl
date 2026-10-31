import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { tick } from "@/lib/multiplayer/server/match";

/** POST /api/v1/matches/:id/tick: heartbeat. Resolves time-based results (bot finishes, disconnects, race caps). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/matches/[id]/tick">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `tick:${player.id}`, 120, 60);
  return ok(await tick(admin, id, player.id));
});
