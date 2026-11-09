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

/** Gap between answer slots, px. */
export const SLOT_GAP = 6;

/**
 * Width of one answer slot: a little narrower than a letter tile, and never so wide that the row of `n` slots
 * runs past `avail` px (seven slots on a 320 px phone).
 */
export function slotWidth(avail: number, n: number, tile: number): number {
  return Math.max(24, Math.min(tile - 4, Math.floor((avail - SLOT_GAP * (n - 1)) / Math.max(1, n))));
}
