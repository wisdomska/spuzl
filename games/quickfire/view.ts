/**
 * Quickfire as it is served for scored play (R4-23). Kept apart from logic.ts, which holds the question bank, so
 * the server's token code (lib/game/guess-token.ts) and the board can use it without loading content.
 */
import type { PuzzleRef } from "@/games/_shared/guess";
import type { QuickfirePuzzle, QuickfireQuestion } from "./logic";

/**
 * A board as the client gets it. Scored boards (an attempt, a race round) carry only how many questions there are
 * and the time limit: each question is handed out by the guess route when it opens. The public practice board
 * (the guided round, the admin preview, the dev fixture) still carries its questions.
 */
export interface QuickfireServed {
  ref: PuzzleRef;
  limitMs: number;
  /** how many questions (scored boards) */
  count?: number;
  /** the questions (practice boards only) */
  questions?: QuickfireQuestion[];
}

/** The scored view: no question text, category or option until its open. */
export function scoredView(p: QuickfirePuzzle): QuickfireServed {
  return { ref: p.ref, limitMs: p.limitMs, count: p.questions.length };
}

/** How many questions a served board has, either way. */
export const questionCount = (p: QuickfireServed): number => p.questions?.length ?? p.count ?? 0;
