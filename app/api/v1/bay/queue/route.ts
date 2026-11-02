import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { cancelBayQueue, joinBayQueue, pollBayQueue } from "@/lib/multiplayer/server/bayQueue";

export const dynamic = "force-dynamic";

// Any string here: the server answers an unknown or retired game (Flip) with 400 not_board_game.
const Join = z.object({ game: z.string().min(2).max(24) });

/** POST /api/v1/bay/queue: Play live. Joins the queue for one board game (live, 5 min clocks) and tries to pair at once. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-queue:${player.id}`, 30, 60);
  const { game } = await body(req, Join);
  return ok(await joinBayQueue(admin, player, game));
});

/** GET /api/v1/bay/queue: poll while searching (about once a second). Pairs as soon as someone fits. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-queue-poll:${player.id}`, 120, 60);
  return ok(await pollBayQueue(admin, player.id));
});

/** DELETE /api/v1/bay/queue: Cancel, or leaving the search screen. */
export const DELETE = handle(async () => {
  const { admin, player } = await requirePlayer();
  await cancelBayQueue(admin, player.id);
  return ok({ ok: true });
});
