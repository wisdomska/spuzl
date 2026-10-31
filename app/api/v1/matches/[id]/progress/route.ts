import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { submitProgress } from "@/lib/multiplayer/server/match";

const Input = z.object({
  round: z.number().int().min(1).max(20),
  state: z.unknown().default(null),
  mistakes: z.number().int().min(0).max(10_000),
});

/** POST /api/v1/matches/:id/progress: board state, at most 2 per second. The server computes progress with the game's own progress(). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/matches/[id]/progress">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `progress:${player.id}`, 200, 60);
  return ok(await submitProgress(admin, id, player.id, await body(req, Input)));
});
