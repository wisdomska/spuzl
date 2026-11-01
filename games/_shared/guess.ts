/**
 * Word-by-word feedback for content games whose answers stay on the server.
 *
 * A content puzzle carries a `ref` ({ game, i, d }): the content index and difficulty that rebuild it with
 * `generateAt`. Boards call `sendGuess(ref, guess)`; the server route resolves the player's open attempt
 * (set with `setGuessAttempt`) or rebuilds the puzzle from `ref`, then calls the game's pure
 * `checkGuess(puzzle, solution, guess, ctx)` from logic.ts and returns its result. The app (or a test) installs
 * the real transport with `setGuessTransport`. In development, with no transport installed, the guess is
 * checked locally (as practice) so the /dev/board fixture works on its own.
 *
 * Requests that give something away (show the answer, the keeper's dive) are answered only with a context:
 * the caller's own open attempt, whose saved state and server move log the logic reads, or a practice board
 * whose answers are public anyway. What such a request gave away is kept on the attempt (`record`), and
 * `audit` checks the final state against it, so a shown answer can't then be scored as a clean solve.
 */
import type { ContentLogic, Difficulty } from "@/games/types";

export interface PuzzleRef {
  game: string;
  /** content index */
  i: number;
  d: Difficulty;
}

/**
 * Where a guess is checked from.
 * - `attempt`: the caller's own in-progress attempt, with its last autosaved state and the entries the server
 *   recorded on it (`record`), oldest first.
 * - `practice`: a board whose answers are public anyway (the guided practice round, the dev fixture).
 * - null: a bare puzzle reference, which could be anyone's scored puzzle; requests that give an answer away
 *   are refused.
 */
export type GuessContext = { kind: "attempt"; state: unknown; log: unknown[] } | { kind: "practice" } | null;

export const PRACTICE: GuessContext = { kind: "practice" };

/** What a content game's logic.ts default export provides on top of GameLogic. */
export interface GuessLogic<P = unknown, S = unknown, St = unknown, G = unknown, R = unknown> extends ContentLogic<P, S, St> {
  checkGuess(puzzle: P, solution: S, guess: G, ctx?: GuessContext): R;
  /**
   * Optional: what to keep on the attempt for this answered guess (a shown answer, a committed shot), or null
   * for nothing. Only called for attempt guesses; the result is sent only once the entry is stored.
   */
  record?(puzzle: P, solution: S, guess: G, result: R, log: unknown[]): unknown;
}

export type GuessTransport = (ref: PuzzleRef, guess: unknown) => Promise<unknown>;

let transport: GuessTransport | null = null;

export function setGuessTransport(t: GuessTransport | null) {
  transport = t;
}

let attemptId: string | null = null;

/** The open attempt guesses belong to (set by the Play screen; null in races and dev fixtures). */
export function setGuessAttempt(id: string | null) {
  attemptId = id;
}

/** Default route the server API is expected to expose. */
export const GUESS_ROUTE = (game: string) => `/api/games/${encodeURIComponent(game)}/guess`;

export async function sendGuess<R>(ref: PuzzleRef, guess: unknown): Promise<R> {
  if (transport) return (await transport(ref, guess)) as R;
  if (process.env.NODE_ENV !== "production" && !attemptId) {
    const { LOGIC } = await import("@/games/logic-registry");
    const l = (await LOGIC[ref.game]()).default as unknown as GuessLogic;
    const g = l.generateAt(ref.i, ref.d);
    return l.checkGuess(g.puzzle, g.solution, guess, PRACTICE) as R;
  }
  const res = await fetch(GUESS_ROUTE(ref.game), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(attemptId ? { ref, guess, attemptId } : { ref, guess }),
  });
  if (!res.ok) throw new Error(`guess failed: ${res.status}`);
  return (await res.json()) as R;
}
