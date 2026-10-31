import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { finishAttempt } from "@/lib/game/service";

const Finish = z.object({
  state: z.unknown().default(null),
  activeMs: z.number().min(0).max(86_400_000),
  mistakes: z.number().int().min(0).max(10_000).default(0),
  deaths: z.number().int().min(0).max(100_000).optional(),
  relaxed: z.boolean().optional(),
  offline: z.boolean().optional(),
  finishedAt: z.string().datetime().optional(),
  localHour: z.number().int().min(0).max(23).optional(),
});

/** POST /api/v1/attempts/:id/finish: server verifies, flags cheats, grants rewards. Idempotent per attempt. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/attempts/[id]/finish">) => {
  const { id } = await ctx.params;
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `finish:${player.id}`, 120, 3600);
  const input = await body(req, Finish);
  const result = await finishAttempt(admin, player.id, id, input, player.ranking_revoked);
  return ok(result);
});
