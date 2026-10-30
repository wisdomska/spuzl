/** Minicross rules shared by the board and the logic. No answers: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const SIZE = 5;

export interface Clue {
  n: number;
  r: number;
  c: number;
  len: number;
  text: string;
}

export interface MinicrossPuzzle {
  ref: PuzzleRef;
  size: number;
  /** true for a black square, row-major */
  blocks: boolean[];
  across: Clue[];
  down: Clue[];
  /** easy days fill a few squares in for you: cell index to letter */
  given?: Record<number, string>;
}

export interface MinicrossSolution {
  /** letter per cell, "#" for blocks */
  grid: string[];
}

export interface MinicrossState {
  /** letter per cell or "" */
  cells: string[];
}

export type MinicrossGuess = MinicrossState;
export type MinicrossCheck = { ok: boolean };

export type Dir = "across" | "down";

/** Clue numbering in reading order: a cell gets a number when it starts an across or down entry of 2+. */
export function numberGrid(blocks: boolean[], size: number) {
  const open = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && !blocks[r * size + c];
  const across: Omit<Clue, "text">[] = [];
  const down: Omit<Clue, "text">[] = [];
  const nums: number[] = new Array(size * size).fill(0);
  let n = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!open(r, c)) continue;
      const a = !open(r, c - 1) && open(r, c + 1);
      const d = !open(r - 1, c) && open(r + 1, c);
      if (!a && !d) continue;
      nums[r * size + c] = ++n;
      if (a) {
        let len = 0;
        while (open(r, c + len)) len++;
        across.push({ n, r, c, len });
      }
      if (d) {
        let len = 0;
        while (open(r + len, c)) len++;
        down.push({ n, r, c, len });
      }
    }
  }
  return { across, down, nums };
}

/** Cells of a clue's entry. */
export function cellsOf(clue: Pick<Clue, "r" | "c" | "len">, dir: Dir, size: number): number[] {
  return Array.from({ length: clue.len }, (_, k) => (dir === "across" ? clue.r * size + clue.c + k : (clue.r + k) * size + clue.c));
}

/** The clue in `dir` that covers cell i, if any. */
export function clueAt(p: Pick<MinicrossPuzzle, "across" | "down" | "size">, i: number, dir: Dir): Clue | undefined {
  return (dir === "across" ? p.across : p.down).find((cl) => cellsOf(cl, dir, p.size).includes(i));
}

export function validCells(p: MinicrossPuzzle, cells: unknown): cells is string[] {
  return Array.isArray(cells) && cells.length === p.size * p.size && cells.every((ch, i) => (p.blocks[i] ? ch === "" || ch === "#" : ch === "" || (typeof ch === "string" && /^[A-Z]$/.test(ch))));
}
