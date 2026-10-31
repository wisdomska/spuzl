import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { createChallenge } from "@/lib/multiplayer/server/async";

const Create = z.object({
  attemptId: z.string().uuid(),
  timeline: z
    .array(z.object({ ms: z.number().min(0).max(86_400_000), state: z.unknown().default(null) }))
    .max(60)
    .optional(),
});

/** POST /api/v1/challenges: "Beat my time" link to the exact puzzle of a verified clear. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `challenge:${player.id}`, 30, 600);
  const input = await body(req, Create);
  return ok(await createChallenge(admin, player.id, input.attemptId, input.timeline));
});
