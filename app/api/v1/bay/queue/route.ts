import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { cancelBayQueue, joinBayQueue, pollBayQueue } from "@/lib/multiplayer/server/bayQueue";
import { requireLivePlay } from "@/lib/multiplayer/server/liveGate";
import { bayLive } from "@/lib/copy/bay-live";

export const dynamic = "force-dynamic";

// Any string here: the server answers an unknown or retired game (Flip) with 400 not_board_game.
const Join = z.object({
  game: z.string().min(2).max(24),
  minutes: z.number().int().min(1).max(60).optional(),
  seats: z.number().int().min(2).max(4).optional(),
  ludo: z.object({ backKick: z.boolean().optional(), sideKick: z.boolean().optional(), homeKick: z.boolean().optional() }).optional(),
});

/** POST /api/v1/bay/queue: Play live. Joins the queue for one board game and time control (minutes per player) and tries to pair at once. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-queue:${player.id}`, 30, 60);
  const { game, minutes, ludo, seats } = await body(req, Join);
  return ok(await joinBayQueue(admin, player, game, minutes, ludo, seats));
});

/** GET /api/v1/bay/queue: poll while searching (about once a second). Pairs as soon as someone fits. 16+ only, like joining. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  requireLivePlay(player, bayLive.ageRestricted);
  await rateLimit(admin, `bay-queue-poll:${player.id}`, 120, 60);
  return ok(await pollBayQueue(admin, player.id));
});

/** DELETE /api/v1/bay/queue: Cancel, or leaving the search screen. */
export const DELETE = handle(async () => {
  const { admin, player } = await requirePlayer();
  await cancelBayQueue(admin, player.id);
  return ok({ ok: true });
});
