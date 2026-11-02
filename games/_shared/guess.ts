/**
 * Word-by-word feedback for content games whose answers stay on the server.
 *
 * A content puzzle is built from a `ContentRef` ({ game, i, d }): the content index and difficulty that rebuild
 * it with `generateAt`. That reference stays on the server: wherever a content puzzle is served, the server
 * swaps it for an opaque `GuessToken` bound to the player and to where the puzzle was served (their open
 * attempt, the current round of a race they are in, or the public practice board), with an expiry
 * (lib/game/guess-token.ts). Boards call `sendGuess(puzzle.ref, guess)`; the server route opens the token,
 * resolves its context, then calls the game's pure `checkGuess(puzzle, solution, guess, ctx)` from logic.ts and
 * returns its result. A bare content reference is refused. The app (or a test) installs another transport
 * with `setGuessTransport`: the admin preview, and the /dev/board fixture (a server action that checks its bare
 * reference as practice). Nothing here loads game logic, so content stays out of client bundles.
 *
 * Requests that give something away (show the answer, the keeper's dive) are answered only with a context:
 * the caller's own open attempt, whose saved state and server move log the logic reads, or a practice board
 * whose answers are public anyway. What such a request gave away is kept on the attempt (`record`), and
 * `audit` checks the final state against it, so a shown answer can't then be scored as a clean solve.
 */
import type { ContentLogic, Difficulty } from "@/games/types";

/** Server side: what rebuilds a content puzzle. Never sent to players as is. */
export interface ContentRef {
  game: string;
  /** content index */
  i: number;
  d: Difficulty;
}

/** Client side: the opaque, bound token the server sends in place of a ContentRef. */
export interface GuessToken {
  game: string;
  t: string;
}

/** A content puzzle's `ref`: a ContentRef where it is built, a GuessToken once it is served. */
export type PuzzleRef = ContentRef | GuessToken;

export const isGuessToken = (r: unknown): r is GuessToken =>
  !!r && typeof r === "object" && typeof (r as GuessToken).t === "string" && typeof (r as GuessToken).game === "string";

/**
 * Where a guess is checked from.
 * - `attempt`: the caller's own in-progress attempt, with its last autosaved state and the entries the server
 *   recorded on it (`record`), oldest first. Log entries carry the server time they were stored at (`t`, ms);
 *   `now` is the server time of this request, for games that time answers on the server (Quickfire).
 * - `practice`: a board whose answers are public anyway (the guided practice round, the dev fixture).
 * - null: a bare puzzle reference, which could be anyone's scored puzzle; requests that give an answer away
 *   are refused.
 */
export type GuessContext = { kind: "attempt"; state: unknown; log: unknown[]; now?: number } | { kind: "practice" } | null;

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

/** Default route the server API is expected to expose. */
export const GUESS_ROUTE = (game: string) => `/api/games/${encodeURIComponent(game)}/guess`;

export async function sendGuess<R>(ref: PuzzleRef, guess: unknown): Promise<R> {
  if (transport) return (await transport(ref, guess)) as R;
  const res = await fetch(GUESS_ROUTE(ref.game), {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The token names its own context (attempt, race round or practice board); nothing else is sent.
    body: JSON.stringify({ ref, guess }),
  });
  if (!res.ok) throw new Error(`guess failed: ${res.status}`);
  return (await res.json()) as R;
}
