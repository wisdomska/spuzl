import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { cancelQueue, enqueue, pollQueue } from "@/lib/multiplayer/server/lobby";

const Join = z.object({ game: z.string().min(2).max(24).nullable().default(null), rulesSeen: z.boolean().default(false) });

/** POST /api/v1/duel/queue: Quick Match. Joins the queue (by duel rating and region) and tries to pair at once. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `queue:${player.id}`, 30, 60);
  const { game, rulesSeen } = await body(req, Join);
  return ok(await enqueue(admin, player, game, rulesSeen));
});

/** GET /api/v1/duel/queue: poll while searching. Pairs as soon as a compatible rival waits. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `queue-poll:${player.id}`, 120, 60);
  return ok(await pollQueue(admin, player.id));
});

/** DELETE /api/v1/duel/queue: Cancel. */
export const DELETE = handle(async () => {
  const { admin, player } = await requirePlayer();
  await cancelQueue(admin, player.id);
  return ok({ ok: true });
});
