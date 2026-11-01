import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer, todayGmt, ApiError } from "@/lib/api/server";
import { startAttempt } from "@/lib/game/service";
import { difficultyForDate } from "@/games/types";
import { getGameSettings } from "@/lib/game-settings/server";

const Start = z.object({
  game: z.string().min(2).max(24),
  mode: z.enum(["tutorial", "daily", "free", "archive", "challenge"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard", "expert", "mega"]).optional(),
  seed: z.string().max(120).optional(),
});

/** POST /api/v1/attempts: start (or resume) an attempt; returns puzzle data without the solution. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const input = await body(req, Start);
  const today = todayGmt();
  // Dailies switched off (admin "features.dailies"): free play is the only solo mode, enforced here.
  if ((input.mode === "daily" || input.mode === "archive") && !(await getGameSettings())["features.dailies"])
    throw new ApiError(404, "dailies_off", "Dailies are off. Free play is open.");
  if (input.mode === "free")
    await rateLimit(admin, `practice:${player.id}`, 60, 3600); // 60 practice puzzles/hour
  else await rateLimit(admin, `attempt:${player.id}`, 120, 3600);
  let date = input.date;
  if (input.mode === "daily") date = today; // the Daily is always today's, GMT
  if (input.mode === "archive") {
    if (!date || date >= today) throw new ApiError(400, "archive_date");
    if (Date.parse(today) - Date.parse(date) > 7 * 86_400_000)
      throw new ApiError(403, "archive_locked", "Older Dailies arrive with SPUZL+.");
  }
  // Seeds from clients are only accepted for tutorials and challenges (exact puzzle links).
  const seed = input.mode === "tutorial" ? `tutorial:${input.game}` : input.mode === "challenge" ? input.seed : undefined;
  // Free play defaults to medium; Dailies follow the weekday curve (Mon easy ... Sun mega).
  const difficulty =
    input.difficulty ?? (input.mode === "tutorial" ? "easy" : input.mode === "free" ? "easy" : difficultyForDate(date ?? today));
  const mode = input.mode === "challenge" ? "free" : input.mode;
  const res = await startAttempt(admin, player.id, { gameId: input.game, mode, date, seed, difficulty });
  return ok({ ...res, date: date ?? null, difficulty });
});
