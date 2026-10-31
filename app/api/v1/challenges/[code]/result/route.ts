import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { challengeResult } from "@/lib/multiplayer/server/async";

const Result = z.object({
  attemptId: z.string().uuid(),
  timeline: z
    .array(z.object({ ms: z.number().min(0).max(86_400_000), state: z.unknown() }))
    .max(60)
    .optional(),
});

/** POST /api/v1/challenges/:code/result: records a verified clear against the sender's time (ghost timeline). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/challenges/[code]/result">) => {
  const { code } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `challenge-result:${player.id}`, 30, 600);
  const input = await body(req, Result);
  return ok(await challengeResult(admin, player.id, code, input.attemptId, input.timeline));
});
