/**
 * Word-by-word feedback for content games whose answers stay on the server.
 *
 * A content puzzle carries a `ref` ({ game, i, d }): the content index and difficulty that rebuild it with
 * `generateAt`. Boards call `sendGuess(ref, guess)`; the server route resolves the player's scheduled
 * puzzle, then calls the game's pure `checkGuess(puzzle, solution, guess)` from logic.ts and returns its
 * result. The app (or a test) installs the real transport with `setGuessTransport`. In development, with
 * no transport installed, the guess is checked locally so the /dev/board fixture works on its own.
 */
import type { ContentLogic, Difficulty } from "@/games/types";

export interface PuzzleRef {
  game: string;
  /** content index */
  i: number;
  d: Difficulty;
}

/** What a content game's logic.ts default export provides on top of GameLogic. */
export interface GuessLogic<P = unknown, S = unknown, St = unknown, G = unknown, R = unknown> extends ContentLogic<P, S, St> {
  checkGuess(puzzle: P, solution: S, guess: G): R;
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
  if (process.env.NODE_ENV !== "production") {
    const { LOGIC } = await import("@/games/logic-registry");
    const l = (await LOGIC[ref.game]()).default as unknown as GuessLogic;
    const g = l.generateAt(ref.i, ref.d);
    return l.checkGuess(g.puzzle, g.solution, guess) as R;
  }
  const res = await fetch(GUESS_ROUTE(ref.game), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref, guess }),
  });
  if (!res.ok) throw new Error(`guess failed: ${res.status}`);
  return (await res.json()) as R;
}
