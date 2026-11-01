import { z } from "zod";
import { GAME_BY_ID } from "@/lib/catalog";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { LOGIC } from "@/games/logic-registry";
import { PRACTICE, type GuessLogic } from "@/games/_shared/guess";
import { assertGameOpen, attemptPuzzle, guidedSeed, loadFree, logAttemptMove } from "@/lib/game/service";
import { checkGuessWith, samePuzzleRef } from "@/lib/game/guess-check";

const Guess = z.object({
  ref: z.object({ game: z.string(), i: z.number().int().min(0).max(100_000), d: z.enum(["easy", "medium", "hard", "expert", "mega"]) }),
  guess: z.unknown().default(null),
  /** the open attempt this guess belongs to; the server checks against that attempt's stored puzzle */
  attemptId: z.uuid().optional(),
});

/**
 * POST /api/games/:game/guess: word-by-word feedback for content games; answers never ship to the client.
 * With `attemptId` the guess is checked against that attempt's stored puzzle (so admin-scheduled custom
 * items work), its autosaved state and its server move log; whatever the game records (a shown answer, a
 * committed shot) is stored on the attempt before the result is sent. Without one (races, guided practice)
 * the puzzle is rebuilt from its content reference, and requests that give an answer away are refused
 * unless it is the public practice board. Rate limited per player.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/games/[game]/guess">) => {
  const { game } = await ctx.params;
  const { admin, player } = await requirePlayer();
  const { ref, guess, attemptId } = await body(req, Guess);
  // Instant feedback (Quads aims for under 600 ms): the rate limit, the attempt lookup and the logic
  // import run side by side. The rate limit is still checked first, so a limited player learns nothing.
  const limited = rateLimit(admin, `guess:${player.id}`, 600, 3600);
  const attempt = attemptId ? attemptPuzzle(admin, player.id, attemptId) : null;
  attempt?.catch(() => {}); // a failure is rethrown below, after the rate limit
  await limited;
  if (ref.game !== game || !LOGIC[game]) throw new ApiError(404, "unknown_game");
  if (GAME_BY_ID[game]) await assertGameOpen(GAME_BY_ID[game]);
  const logic = (await LOGIC[game]()).default as unknown as Partial<GuessLogic>;
  if (typeof logic.checkGuess !== "function" || typeof logic.generateAt !== "function") throw new ApiError(400, "no_guess_check");
  const checker = { checkGuess: logic.checkGuess, record: logic.record };
  if (attempt && attemptId) {
    const a = await attempt;
    if (a.gameId !== game) throw new ApiError(400, "wrong_game");
    const out = checkGuessWith(checker, a.puzzle, a.solution, guess, { kind: "attempt", state: a.state, log: a.log });
    // Kept on the attempt first: if the log moved on meanwhile (another guess at once), nothing is given away.
    if (out.entry && !(await logAttemptMove(admin, player.id, attemptId, a.log.length, out.entry)))
      throw new ApiError(409, "guess_conflict");
    return ok(out.result);
  }
  if (ref.i >= (logic.contentCount ?? Infinity) * 4) throw new ApiError(400, "bad_ref");
  const g = logic.generateAt(ref.i, ref.d);
  const practice = GAME_BY_ID[game] ? samePuzzleRef((await loadFree(game, guidedSeed(game), "easy")).puzzle, ref) : false;
  return ok(checker.checkGuess(g.puzzle, g.solution, guess, practice ? PRACTICE : null));
});
