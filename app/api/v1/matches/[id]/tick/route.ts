import { handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { tick } from "@/lib/multiplayer/server/match";
import { requireAdult } from "@/lib/multiplayer/server/adult";

/** POST /api/v1/matches/:id/tick: heartbeat. Resolves time-based results (bot finishes, disconnects, race caps, party rounds). */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/matches/[id]/tick">) => {
  const { id } = await ctx.params;
  const { admin, user, player } = await requirePlayer();
  await rateLimit(admin, `tick:${player.id}`, 120, 60);
  return ok(await tick(admin, id, player.id, () => requireAdult(admin, user, player)));
});
