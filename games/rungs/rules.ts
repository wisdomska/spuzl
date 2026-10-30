/** Rungs rules shared by the board and the logic. No content, no answers: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const LEN = 4;
export const RUNGS = 5;

export interface RungsPuzzle {
  ref: PuzzleRef;
  /** the five trivia rungs, in the (shuffled) order they are first shown */
  clues: string[];
  /** clues for the top and bottom words, shown once the ladder is locked */
  caps: [string, string];
  /** easy days give each trivia rung's first letter */
  starts?: string[];
}

export interface RungsSolution {
  /** top, five rungs, bottom */
  words: string[];
  /** display rung k holds words[1 + order[k]]... stored as the word index for each display rung */
  display: number[];
}

export interface RungsState {
  /** answer per display rung (uppercase) or "" */
  answers: string[];
  /** display rung ids from top to bottom */
  order: number[];
  /** top and bottom words, in the solution's orientation */
  caps: [string, string];
}

export type RungsGuess =
  | { kind: "rung"; rung: number; word: string }
  | { kind: "order"; order: number[] }
  | { kind: "cap"; cap: 0 | 1; word: string };

export type RungsCheck = { ok: boolean; reversed?: boolean };

export const isWordShape = (w: unknown): w is string => typeof w === "string" && /^[A-Z]{4}$/.test(w);

export function diffCount(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) n++;
  return n;
}

/** Index of the single changed letter between two words, or -1. */
export function changedAt(a: string, b: string): number {
  if (diffCount(a, b) !== 1) return -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

export function isPermutation(order: unknown, n: number): order is number[] {
  return Array.isArray(order) && order.length === n && new Set(order).size === n && order.every((x) => Number.isInteger(x) && x >= 0 && x < n);
}
