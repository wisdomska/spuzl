/** Remix rules shared by the board and the logic. No answers: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const ROUNDS = 3;

export interface RemixRound {
  /** the scrambled letters */
  letters: string[];
}

export interface RemixPuzzle {
  ref: PuzzleRef;
  rounds: RemixRound[];
  /** easy days give each word's first letter */
  starts?: string[];
}

export interface RemixSolution {
  words: string[];
}

export interface RemixState {
  /** solved word per round, in order */
  answers: string[];
}

export type RemixGuess = { round: number; word: string };
export type RemixCheck = { ok: boolean };

export const sortLetters = (w: string | string[]) => [...w].sort().join("");

/** Uses exactly the round's letters. */
export function isAnagram(letters: string[], word: string): boolean {
  return typeof word === "string" && /^[A-Z]+$/.test(word) && sortLetters(letters) === sortLetters(word);
}
