import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { BOT_GAME_RATE, BotGameInput } from "@/lib/bot/record";

/**
 * POST /api/v1/bot-games {game, level, outcome, durationMs?}: one finished game against the bot, on the signed-in
 * player's record (admin player page, data export). No XP, Sparks or rating. Practice rounds never call this.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const input = await body(req, BotGameInput);
  await rateLimit(admin, `bot-games:${player.id}`, BOT_GAME_RATE.max, BOT_GAME_RATE.windowSeconds);
  const { error } = await admin.from("bot_games").insert({
    player_id: player.id,
    game_id: input.game,
    level: input.level,
    outcome: input.outcome,
    duration_ms: input.durationMs ?? null,
  });
  if (error) throw error;
  return ok({ ok: true }, { status: 201 });
});
