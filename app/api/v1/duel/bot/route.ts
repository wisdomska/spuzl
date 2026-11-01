import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { practiceBot } from "@/lib/multiplayer/server/lobby";

const Bot = z.object({ game: z.string().min(2).max(24).nullable().default(null) });

/** POST /api/v1/duel/bot: the clearly labelled Practice bot, offered from the start. Unrated. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bot:${player.id}`, 20, 600);
  const { game } = await body(req, Bot);
  return ok(await practiceBot(admin, player.id, game));
});
