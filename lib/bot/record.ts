import { z } from "zod";
import { BOT_GAMES } from "./index";
import { BOT_LEVELS } from "./types";

/**
 * One finished game against the bot, as the client reports it (owner, 12 Nov 2026: bot games show on the player's
 * record). Casual and unrewarded, so the server stores what it is told within these bounds; nothing reads it for XP,
 * Sparks, ratings or leaderboards.
 */
export const BotGameInput = z.object({
  game: z.enum(BOT_GAMES),
  level: z.enum(BOT_LEVELS),
  outcome: z.enum(["won", "lost", "draw"]),
  /** wall time from the first move to the end, when known */
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
});
export type BotGameRecord = z.infer<typeof BotGameInput>;

/** At most this many bot games a player can log an hour (a quick game takes a minute or more). */
export const BOT_GAME_RATE = { max: 120, windowSeconds: 3600 } as const;
