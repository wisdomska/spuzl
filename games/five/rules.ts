/** Five rules shared by the board and the logic. No answers, no word list: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const LEN = 5;
export const TRIES = 6;

/** Per-letter feedback: 2 right spot, 1 in the word but elsewhere, 0 not in the word. */
export type Mark = 0 | 1 | 2;
export const HIT = 2 satisfies Mark;
export const NEAR = 1 satisfies Mark;
export const MISS = 0 satisfies Mark;

export interface FivePuzzle {
  ref: PuzzleRef;
  len: number;
  tries: number;
}

export interface FiveSolution {
  answer: string;
}

/** Every counted guess, uppercase, in order. Non-words never enter the state. */
export interface FiveState {
  guesses: string[];
  /** spots (0-based) already shown by a hint, so the next hint shows a new one */
  hinted?: number[];
}

/** A typed word, or (after six misses) a request to show the answer with the six misses as proof. */
export type FiveGuess = string | { reveal: string[] };

export type FiveCheck =
  | { ok: boolean; word: string; marks: Mark[] }
  | { ok: false; invalid: "length" | "word" }
  | { reveal: string }
  | { ok: false; refused: true };

export const isFiveWord = (w: unknown): w is string => typeof w === "string" && /^[A-Z]{5}$/.test(w);

/**
 * Wordle-style marks. Exact matches first, then each remaining guess letter takes one unused copy of
 * that letter from the answer, left to right, so a doubled letter is marked only as often as it appears.
 */
export function markGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = new Array(guess.length).fill(MISS);
  const left = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = HIT;
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === HIT) continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) {
      marks[i] = NEAR;
      left.set(guess[i], n - 1);
    }
  }
  return marks;
}

/** Best mark seen per letter across rows (for the keyboard). */
export function letterMarks(rows: { word: string; marks: Mark[] }[]): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const r of rows) {
    for (let i = 0; i < r.word.length; i++) {
      const ch = r.word[i];
      const m = r.marks[i];
      if (out[ch] === undefined || m > out[ch]) out[ch] = m;
    }
  }
  return out;
}
