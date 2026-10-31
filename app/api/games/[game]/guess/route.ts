import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { LOGIC } from "@/games/logic-registry";
import type { GuessLogic } from "@/games/_shared/guess";
import { attemptPuzzle } from "@/lib/game/service";

const Guess = z.object({
  ref: z.object({ game: z.string(), i: z.number().int().min(0).max(100_000), d: z.enum(["easy", "medium", "hard", "expert", "mega"]) }),
  guess: z.unknown(),
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
  await rateLimit(admin, `guess:${player.id}`, 600, 3600);
  const { ref, guess, attemptId } = await body(req, Guess);
  if (ref.game !== game || !LOGIC[game]) throw new ApiError(404, "unknown_game");
  const logic = (await LOGIC[game]()).default as unknown as Partial<GuessLogic>;
  if (typeof logic.checkGuess !== "function" || typeof logic.generateAt !== "function") throw new ApiError(400, "no_guess_check");
  if (attemptId) {
    const a = await attemptPuzzle(admin, player.id, attemptId);
    if (a.gameId !== game) throw new ApiError(400, "wrong_game");
    return ok(logic.checkGuess(a.puzzle, a.solution, guess));
  }
  if (ref.i >= (logic.contentCount ?? Infinity) * 4) throw new ApiError(400, "bad_ref");
  const g = logic.generateAt(ref.i, ref.d);
  return ok(logic.checkGuess(g.puzzle, g.solution, guess));
});
