import { z } from "zod";
import { playableGame } from "@/lib/catalog";
import { body, handle, ok, rateLimit, requirePlayer, ApiError } from "@/lib/api/server";
import { LOGIC } from "@/games/logic-registry";
import { PRACTICE, type GuessLogic } from "@/games/_shared/guess";
import { assertGameOpen, attemptPuzzle, guidedSeed, loadFree, logAttemptMove } from "@/lib/game/service";
import { checkGuessWith, samePuzzleRef } from "@/lib/game/guess-check";
import { openGuessToken } from "@/lib/game/guess-token";
import { raceGuess } from "@/lib/multiplayer/server/match";

const Guess = z.object({
  /** the token the server sent in the puzzle's `ref` (a bare content reference is refused) */
  ref: z.object({ game: z.string().max(24), t: z.string().max(600) }),
  guess: z.unknown().default(null),
  /** the open attempt the board belongs to; must match the token's attempt when sent */
  attemptId: z.uuid().optional(),
});

/**
 * POST /api/games/:game/guess: word-by-word feedback for content games; answers never ship to the client.
 * The puzzle's `ref` is an opaque token (lib/game/guess-token.ts) bound to where the puzzle was served:
 * - the player's own open attempt: the guess is checked against that attempt's stored puzzle (so
 *   admin-scheduled custom items work), its autosaved state and its server move log; whatever the game records
 *   (a shown answer, a committed shot) is stored on the attempt before the result is sent;
 * - the current round of a race or duel the player races in: checked against the round puzzle; requests that
 *   give an answer away are refused, except in a Party score race (R3-08), judged like an attempt on a server log
 *   per racer and round;
 * - the public guided practice board: checked as practice.
 * A bare content reference, a forged, expired or someone else's token, or one used outside its context is
 * refused. Rate limited per player.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/games/[game]/guess">) => {
  const { game } = await ctx.params;
  const { admin, player } = await requirePlayer();
  // A bare content reference (`{ game, i, d }`, as old clients send) fails here with a 400.
  const { ref, guess, attemptId } = await body(req, Guess);
  // The rate limit is checked first, so a limited player learns nothing; the logic import runs meanwhile.
  const limited = rateLimit(admin, `guess:${player.id}`, 600, 3600);
  const logicP = LOGIC[game]?.();
  logicP?.catch(() => {});
  await limited;
  const meta = playableGame(game);
  if (ref.game !== game || !LOGIC[game] || !meta) throw new ApiError(404, "unknown_game");
  // A game Off, or In testing for a player (Games page state), answers like an unknown one, before the token is read.
  await assertGameOpen(meta);
  const tok = openGuessToken(ref.t);
  if (!tok || tok.g !== game) throw new ApiError(400, "bad_ref");
  if (tok.c.k !== "p" && tok.p !== player.id) throw new ApiError(403, "not_your_puzzle");
  const logic = (await logicP!).default as unknown as Partial<GuessLogic>;
  if (typeof logic.checkGuess !== "function" || typeof logic.generateAt !== "function") throw new ApiError(400, "no_guess_check");
  const checker = { checkGuess: logic.checkGuess, record: logic.record };
  const c = tok.c;

  if (c.k === "a") {
    if (attemptId && attemptId !== c.a) throw new ApiError(400, "wrong_attempt");
    const a = await attemptPuzzle(admin, player.id, c.a);
    if (a.gameId !== game) throw new ApiError(400, "wrong_game");
    const out = checkGuessWith(checker, a.puzzle, a.solution, guess, { kind: "attempt", state: a.state, log: a.log });
    // Kept on the attempt first: if the log moved on meanwhile (another guess at once), nothing is given away.
    if (out.entry && !(await logAttemptMove(admin, player.id, c.a, a.log.length, out.entry))) throw new ApiError(409, "guess_conflict");
    return ok(out.result);
  }
  if (attemptId) throw new ApiError(400, "wrong_attempt");

  if (c.k === "m") {
    // A Party score race round (R3-08) is judged like a solo attempt, on a server log per racer and round.
    const ref = { game: tok.g, i: tok.i, d: tok.d };
    return ok(await raceGuess(admin, player.id, { m: c.m, s: c.s, r: c.r, game, ref }, guess, checker));
  }

  // Practice: only the guided board was ever given a practice token; checked again against it all the same.
  const board = await loadFree(game, guidedSeed(game), "easy");
  if (!samePuzzleRef(board.puzzle, { game: tok.g, i: tok.i, d: tok.d })) throw new ApiError(400, "bad_ref");
  return ok(checker.checkGuess(board.puzzle, board.solution, guess, PRACTICE));
});
