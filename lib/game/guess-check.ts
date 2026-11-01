/**
 * Pure server steps of the guess transport (games/_shared/guess.ts), kept apart from the database so they can
 * be unit tested: answering one guess with its context, and the final verdict at finish.
 */
import type { GuessContext, GuessLogic } from "@/games/_shared/guess";
import type { GameLogic, VerifyResult } from "@/games/types";

export interface CheckedGuess {
  result: unknown;
  /** what to append to the attempt's move log before the result is sent (null: nothing) */
  entry: Record<string, unknown> | null;
}

/** Answers one guess. For an attempt, the game's `record` says what to keep; entries are stamped with `t` (ms). */
export function checkGuessWith(
  logic: Pick<GuessLogic, "checkGuess" | "record">,
  puzzle: unknown,
  solution: unknown,
  guess: unknown,
  ctx: GuessContext,
  now = Date.now(),
): CheckedGuess {
  const result = logic.checkGuess(puzzle, solution, guess, ctx);
  if (ctx?.kind !== "attempt" || !logic.record) return { result, entry: null };
  const e = logic.record(puzzle, solution, guess, result, ctx.log);
  return { result, entry: e && typeof e === "object" ? { ...(e as Record<string, unknown>), t: now } : null };
}

/** True when `puzzle` (the guided practice board, whose answers are public anyway) has this content reference. */
export function samePuzzleRef(puzzle: unknown, b: { game: string; i: number; d: string }): boolean {
  const r = (puzzle as { ref?: { game?: unknown; i?: unknown; d?: unknown } } | null)?.ref;
  return !!r && r.game === b.game && r.i === b.i && r.d === b.d;
}

/** Finish: the game's verify, then its audit of the attempt's move log. An audit reason fails the clear. */
export function finalVerdict(
  logic: GameLogic,
  puzzle: unknown,
  solution: unknown,
  state: unknown,
  log: unknown[],
): { verdict: VerifyResult } {
  const verdict = logic.verify(puzzle, solution, state);
  if (!verdict.ok || !logic.audit) return { verdict };
  const reason = logic.audit(puzzle, solution, state, log);
  return { verdict: reason ? { ok: false, progress: verdict.progress, reason } : verdict };
}
