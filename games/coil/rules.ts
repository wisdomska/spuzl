/**
 * Coil rules shared by the board and the logic. No content, no answers: safe for the client bundle.
 */
import type { PuzzleRef } from "@/games/_shared/guess";

export const ROWS = 6;
export const COLS = 5;

export interface CoilPuzzle {
  ref: PuzzleRef;
  rows: number;
  cols: number;
  /** one uppercase letter per cell, row-major */
  letters: string[];
  theme: string;
  /** number of theme words */
  count: number;
}

export interface CoilSolution {
  words: string[];
  /** cell path per word, first letter first */
  paths: number[][];
}

/** Found word paths, in the order they were found. */
export interface CoilState {
  found: number[][];
}

/** A guess is a traced path of cell indices. */
export type CoilGuess = number[];

export type CoilCheck =
  | { ok: true; index: number; word: string; path: number[] }
  | { ok: false; reason: "path" | "short" | "spot" | "off-theme" | "not-word"; word?: string };

export const MIN_LEN = 4;

export function rc(i: number, cols: number): [number, number] {
  return [Math.floor(i / cols), i % cols];
}

/** 8-direction neighbours. */
export function adjacent(a: number, b: number, cols: number): boolean {
  if (a === b) return false;
  const [ra, ca] = rc(a, cols);
  const [rb, cb] = rc(b, cols);
  return Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
}

/** A path is valid when it stays on the board, never reuses a cell and steps between neighbours. */
export function validPath(path: unknown, rows: number, cols: number): path is number[] {
  if (!Array.isArray(path) || path.length === 0) return false;
  const seen = new Set<number>();
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (!Number.isInteger(i) || i < 0 || i >= rows * cols || seen.has(i)) return false;
    if (k > 0 && !adjacent(path[k - 1], i, cols)) return false;
    seen.add(i);
  }
  return true;
}

export function spell(letters: string[], path: number[]): string {
  return path.map((i) => letters[i]).join("");
}

/** Same cells, ignoring order. */
export function sameCells(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((i) => s.has(i));
}

export const REASON_COPY: Record<Exclude<CoilCheck, { ok: true }>["reason"], string> = {
  path: "Letters must touch, in any direction.",
  short: "Words need 4 letters or more.",
  spot: "Right word, but it lives somewhere else.",
  "off-theme": "Real word, not on theme.",
  "not-word": "Not a word we know.",
};
