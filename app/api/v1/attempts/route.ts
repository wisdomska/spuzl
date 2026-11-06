import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer, todayGmt, ApiError } from "@/lib/api/server";
import { resumeAttempt, startAttempt } from "@/lib/game/service";
import { difficultyForDate } from "@/games/types";
import { getGameSettings } from "@/lib/game-settings/server";
import { MAX_LEVEL } from "@/lib/game/levels";
import { fiveDate, rulesFrom } from "@/lib/daily-five";
import { ensureDay } from "@/lib/daily-five/server";

const Start = z.object({
  game: z.string().min(2).max(24),
  // Challenges start through /api/v1/challenges/:code/accept, which serves the sender's puzzle.
  // five: a Daily Five game (R2-05), played as that day's shared Daily on the five's scheduled puzzle.
  mode: z.enum(["tutorial", "daily", "free", "archive", "level", "five"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard", "expert", "mega"]).optional(),
  /** level mode: which level (default the player's next one); unlocked one at a time, checked on the server */
  level: z.number().int().min(1).max(MAX_LEVEL).optional(),
  /** free play and levels: an attempt of the player's they left part way; picked up when it is still open */
  resume: z.string().uuid().optional(),
});

/**
 * POST /api/v1/attempts: start (or resume) an attempt; returns puzzle data without the solution or the seed.
 * Free play's seed is made here and kept on the attempt (server only), so a client can neither pick a board
 * it has already solved nor rebuild the solution from what it was sent. Level mode starts level `level` (or the
 * player's next) only when it is unlocked: one past their highest verified clear at most.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const input = await body(req, Start);
  const today = todayGmt();
  if (input.mode === "five") {
    // Daily Five: its own switch, on whether or not Dailies are. The day and the puzzle are the server's.
    const settings = await getGameSettings();
    if (!settings["dailyFive.enabled"]) throw new ApiError(404, "daily_five_off", "The Daily Five is resting today. Free play is open.");
    await rateLimit(admin, `attempt:${player.id}`, 120, 3600);
    const rules = rulesFrom(settings);
    const date = fiveDate(new Date(), rules.resetHour);
    await ensureDay(admin, date, settings);
    const res = await startAttempt(admin, player.id, { gameId: input.game, mode: "daily", date, difficulty: rules.difficulty, five: true });
    // The player's first game of this day's five (for the admin Metrics "starts", sent by the client).
    let first = false;
    if (!res.resumed) {
      const { count } = await admin
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("player_id", player.id)
        .eq("daily_five", true)
        .eq("daily_date", date);
      first = count === 1;
    }
    return ok({ ...res, date, difficulty: rules.difficulty, five: true, first });
  }
  // Dailies switched off (admin "features.dailies"): free play is the only solo mode, enforced here.
  if ((input.mode === "daily" || input.mode === "archive") && !(await getGameSettings())["features.dailies"])
    throw new ApiError(404, "dailies_off", "Dailies are off. Free play is open.");
  if (input.mode === "free" || input.mode === "level")
    await rateLimit(admin, `practice:${player.id}`, 60, 3600); // 60 practice puzzles/hour
  else await rateLimit(admin, `attempt:${player.id}`, 120, 3600);
  let date = input.date;
  if (input.mode === "daily") date = today; // the Daily is always today's, GMT
  if (input.mode === "archive") {
    if (!date || date >= today) throw new ApiError(400, "archive_date");
    if (Date.parse(today) - Date.parse(date) > 7 * 86_400_000)
      throw new ApiError(403, "archive_locked", "Older Dailies arrive with SPUZL+.");
  }
  // A free-play or level attempt the player left part way: the same puzzle, state and time, if it is still open.
  if (input.resume && (input.mode === "free" || input.mode === "level")) {
    const res = await resumeAttempt(admin, player.id, input.resume, { gameId: input.game, mode: input.mode, level: input.level });
    if (res) return ok({ ...res, date: null });
  }
  // Clients never choose a seed: the tutorial is the fixed public practice board, free play gets a fresh one.
  const seed = input.mode === "tutorial" ? `tutorial:${input.game}` : undefined;
  // Free play defaults to medium; Dailies follow the weekday curve (Mon easy ... Sun mega).
  const difficulty =
    input.difficulty ?? (input.mode === "tutorial" ? "easy" : input.mode === "free" ? "easy" : difficultyForDate(date ?? today));
  // Levels take no seed or difficulty from the client: the server builds level n from its own seed.
  const res = await startAttempt(admin, player.id, { gameId: input.game, mode: input.mode, date, seed, difficulty, level: input.level });
  return ok({ ...res, date: date ?? null, difficulty });
});
