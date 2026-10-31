/** Buried rules shared by the board and the logic. Safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const COLS = 7;

export interface BuriedPuzzle {
  ref: PuzzleRef;
  rows: number;
  cols: number;
  letters: string[];
  theme: string;
  /** the hidden words to find (a word search shows its list) */
  words: string[];
  /** letters per word of the secret phrase */
  phraseShape: number[];
}

export interface Placement {
  word: string;
  cells: number[];
}

export interface BuriedSolution {
  placements: Placement[];
  phrase: string;
}

export interface BuriedState {
  found: number[][];
  /** Bonus word lines: real words that are not on the list. Shown only; they never use up letters. */
  bonus?: number[][];
}

export type BuriedGuess = number[];
/** `bonus` marks a real word off the list: never a mistake, never counts toward the clear. */
export type BuriedCheck =
  { ok: true; bonus?: undefined; word: string } | { ok: false; bonus: true; word: string } | { ok: false; bonus?: undefined };

/** Shortest line that can count as a bonus word. */
export const BONUS_MIN = 4;

/** Cells from a to b if they lie on one row, column or diagonal; otherwise null. */
export function lineBetween(a: number, b: number, cols: number): number[] | null {
  const ra = Math.floor(a / cols),
    ca = a % cols,
    rb = Math.floor(b / cols),
    cb = b % cols;
  const dr = Math.sign(rb - ra),
    dc = Math.sign(cb - ca);
  const n = Math.max(Math.abs(rb - ra), Math.abs(cb - ca));
  if (!(ra === rb || ca === cb || Math.abs(rb - ra) === Math.abs(cb - ca))) return null;
  return Array.from({ length: n + 1 }, (_, k) => (ra + dr * k) * cols + ca + dc * k);
}

/** Snaps a drag from `a` toward `b` onto the nearest of the 8 directions. */
export function snapLine(a: number, b: number, rows: number, cols: number): number[] {
  const ra = Math.floor(a / cols),
    ca = a % cols,
    rb = Math.floor(b / cols),
    cb = b % cols;
  let dr = rb - ra,
    dc = cb - ca;
  if (dr && dc && Math.abs(dr) !== Math.abs(dc)) {
    if (Math.abs(dr) > 2 * Math.abs(dc)) dc = 0;
    else if (Math.abs(dc) > 2 * Math.abs(dr)) dr = 0;
    else {
      const m = Math.min(Math.abs(dr), Math.abs(dc));
      dr = Math.sign(dr) * m;
      dc = Math.sign(dc) * m;
    }
  }
  const er = Math.max(0, Math.min(rows - 1, ra + dr)),
    ec = Math.max(0, Math.min(cols - 1, ca + dc));
  return lineBetween(a, er * cols + ec, cols) ?? [a];
}

export function isStraight(path: unknown, rows: number, cols: number): path is number[] {
  if (!Array.isArray(path) || path.length < 2 || !path.every((i) => Number.isInteger(i) && i >= 0 && i < rows * cols)) return false;
  const line = lineBetween(path[0], path[path.length - 1], cols);
  return !!line && line.length === path.length && line.every((x, k) => x === path[k]);
}

/** The listed word a straight path spells, read either way, or null. */
export function wordOn(p: BuriedPuzzle, path: number[]): string | null {
  if (!isStraight(path, p.rows, p.cols)) return null;
  const s = path.map((i) => p.letters[i]).join("");
  const r = [...s].reverse().join("");
  return p.words.includes(s) ? s : p.words.includes(r) ? r : null;
}

/** Leftover letters in reading order, once every word is found. */
export function leftovers(p: BuriedPuzzle, found: number[][]): string {
  const used = new Set(found.flat());
  return p.letters.filter((_, i) => !used.has(i)).join("");
}

export function splitPhrase(letters: string, shape: number[]): string[] {
  const out: string[] = [];
  let k = 0;
  for (const n of shape) {
    out.push(letters.slice(k, k + n));
    k += n;
  }
  return out;
}
