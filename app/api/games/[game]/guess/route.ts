import { z } from "zod";
import { GAME_BY_ID } from "@/lib/catalog";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { LOGIC } from "@/games/logic-registry";
import type { GuessLogic } from "@/games/_shared/guess";
import { assertGameOpen, attemptPuzzle } from "@/lib/game/service";

const Guess = z.object({
  ref: z.object({ game: z.string(), i: z.number().int().min(0).max(100_000), d: z.enum(["easy", "medium", "hard", "expert", "mega"]) }),
  guess: z.unknown().default(null),
  /** the open attempt this guess belongs to; the server checks against that attempt's stored puzzle */
  attemptId: z.uuid().optional(),
});

/**
 * POST /api/games/:game/guess: word-by-word feedback for content games; answers never ship to the client.
 * With `attemptId` the guess is checked against that attempt's stored puzzle (so admin-scheduled custom
 * items work); without one (races) the puzzle is rebuilt from its content reference. Rate limited per player.
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
  if (attempt) {
    const a = await attempt;
    if (a.gameId !== game) throw new ApiError(400, "wrong_game");
    return ok(logic.checkGuess(a.puzzle, a.solution, guess));
  }
  if (ref.i >= (logic.contentCount ?? Infinity) * 4) throw new ApiError(400, "bad_ref");
  const g = logic.generateAt(ref.i, ref.d);
  return ok(logic.checkGuess(g.puzzle, g.solution, guess));
});
