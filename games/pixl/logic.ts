/**
 * Pixl: a nonogram. Row and column clues list the runs of filled cells; filling them all paints a
 * picture. Pictures come from the original art library (art.ts) or seeded symmetric patterns. Every
 * published puzzle is proven unique by the line solver alone, so it never needs a guess.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { ART, artCells } from "./art";

export const EMPTY = 0;
export const FILL = 1;
export const CROSS = 2;

export interface PixlPuzzle {
  w: number;
  h: number;
  rows: number[][];
  cols: number[][];
}
/** 1 filled, 0 empty; row-major */
export type PixlSolution = number[];
/** 0 empty, 1 filled, 2 marked X; row-major */
export type PixlState = number[];

export const SIZE_FOR: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 8, expert: 10, mega: 12 };

/* ---------------- Clues and lines ---------------- */

export function runs(line: number[]): number[] {
  const out: number[] = [];
  let k = 0;
  for (const v of line) {
    if (v === FILL) k++;
    else if (k) {
      out.push(k);
      k = 0;
    }
  }
  if (k) out.push(k);
  return out;
}

export function rowCells(p: { w: number }, r: number): number[] {
  return Array.from({ length: p.w }, (_, c) => r * p.w + c);
}
export function colCells(p: { w: number; h: number }, c: number): number[] {
  return Array.from({ length: p.h }, (_, r) => r * p.w + c);
}

export function cluesFor(w: number, h: number, cells: number[]): PixlPuzzle {
  const p = { w, h, rows: [] as number[][], cols: [] as number[][] };
  for (let r = 0; r < h; r++) p.rows.push(runs(rowCells(p, r).map((i) => cells[i])));
  for (let c = 0; c < w; c++) p.cols.push(runs(colCells(p, c).map((i) => cells[i])));
  return p;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/* ---------------- Line solver ---------------- */

/** Cell knowledge for the solver: -1 unknown, 0 empty, 1 filled. */
export const UNKNOWN = -1;

/**
 * Settles every cell of one line that is the same in all arrangements of `clue` consistent with
 * `line`. Returns null when no arrangement fits.
 */
export function solveLine(clue: number[], line: number[]): number[] | null {
  const n = line.length, m = clue.length;
  const memo = new Map<number, boolean>();
  const key = (i: number, k: number) => i * (m + 1) + k;
  const fits = (i: number, k: number): boolean => {
    if (i >= n) return k === m;
    const id = key(i, k);
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    let ok = false;
    if (line[i] !== FILL && fits(i + 1, k)) ok = true;
    if (!ok && k < m && blockFits(i, clue[k]) && fits(i + clue[k] + 1, k + 1)) ok = true;
    memo.set(id, ok);
    return ok;
  };
  const blockFits = (i: number, len: number) => {
    if (i + len > n) return false;
    for (let j = i; j < i + len; j++) if (line[j] === EMPTY) return false;
    return i + len === n || line[i + len] !== FILL;
  };
  if (!fits(0, 0)) return null;
  const can1 = new Array<boolean>(n).fill(false);
  const can0 = new Array<boolean>(n).fill(false);
  const seen = new Set<number>();
  const stack: [number, number][] = [[0, 0]];
  while (stack.length) {
    const [i, k] = stack.pop()!;
    if (i >= n || seen.has(key(i, k))) continue;
    seen.add(key(i, k));
    if (line[i] !== FILL && fits(i + 1, k)) {
      can0[i] = true;
      stack.push([i + 1, k]);
    }
    if (k < m && blockFits(i, clue[k]) && fits(i + clue[k] + 1, k + 1)) {
      for (let j = i; j < i + clue[k]; j++) can1[j] = true;
      if (i + clue[k] < n) can0[i + clue[k]] = true;
      stack.push([i + clue[k] + 1, k + 1]);
    }
  }
  return line.map((v, i) => (can1[i] && !can0[i] ? FILL : can0[i] && !can1[i] ? EMPTY : v));
}

interface Lines {
  cells: number[];
  clue: number[];
  label: string;
}
function allLines(p: PixlPuzzle): Lines[] {
  const out: Lines[] = [];
  for (let r = 0; r < p.h; r++) out.push({ cells: rowCells(p, r), clue: p.rows[r], label: `Row ${r + 1}` });
  for (let c = 0; c < p.w; c++) out.push({ cells: colCells(p, c), clue: p.cols[c], label: `Column ${c + 1}` });
  return out;
}

/** Line-by-line propagation to a fixpoint. Returns false on a contradiction; `grid` is updated in place. */
export function propagate(p: PixlPuzzle, grid: number[], onStep?: () => void): boolean {
  const ls = allLines(p);
  let dirty = true;
  while (dirty) {
    dirty = false;
    for (const l of ls) {
      const cur = l.cells.map((i) => grid[i]);
      const next = solveLine(l.clue, cur);
      if (!next) return false;
      next.forEach((v, k) => {
        if (v !== cur[k]) {
          grid[l.cells[k]] = v;
          dirty = true;
        }
      });
      onStep?.();
    }
  }
  return true;
}

export function countSolutions(p: PixlPuzzle, limit = 2): number {
  let count = 0;
  const rec = (grid: number[]) => {
    if (count >= limit || !propagate(p, grid)) return;
    const i = grid.indexOf(UNKNOWN);
    if (i < 0) {
      count++;
      return;
    }
    for (const v of [FILL, EMPTY]) {
      const next = grid.slice();
      next[i] = v;
      rec(next);
    }
  };
  rec(new Array(p.w * p.h).fill(UNKNOWN));
  return count;
}

/** Line logic alone fills the grid (and so the puzzle is unique). Returns the grid it reached. */
export function lineSolve(p: PixlPuzzle): { solved: boolean; grid: number[]; passes: number } {
  const grid = new Array(p.w * p.h).fill(UNKNOWN);
  let passes = 0;
  const ok = propagate(p, grid, () => passes++);
  return { solved: ok && !grid.includes(UNKNOWN), grid, passes };
}

/* ---------------- Rules (client feedback) ---------------- */

export interface Analysis {
  bad: Set<number>;
  /** line indexes (rows then columns) whose runs equal the clue */
  done: Set<number>;
  message: string;
  clear: boolean;
}

export function analyze(p: PixlPuzzle, state: PixlState): Analysis {
  const bad = new Set<number>();
  const done = new Set<number>();
  let message = "";
  allLines(p).forEach((l, k) => {
    const filled = l.cells.map((i) => (state[i] === FILL ? FILL : EMPTY));
    const rs = runs(filled);
    if (same(rs, l.clue)) done.add(k);
    const sum = l.clue.reduce((a, b) => a + b, 0);
    const max = Math.max(0, ...l.clue);
    const over = rs.reduce((a, b) => a + b, 0) > sum;
    const long = rs.some((x) => x > max);
    if (over || long) {
      l.cells.forEach((i) => state[i] === FILL && bad.add(i));
      message ||= over ? `${l.label} has more filled cells than its clue.` : `${l.label} has a run longer than any clue.`;
    }
  });
  return { bad, done, message, clear: done.size === p.w + p.h };
}

/* ---------------- Hints and grading ---------------- */

/** Knowledge grid from a player's marks: fills are filled, crosses are empty, the rest unknown. */
const knowledge = (state: PixlState) => state.map((v) => (v === FILL ? FILL : v === CROSS ? EMPTY : UNKNOWN));

export interface Deduction {
  cell: number;
  value: typeof FILL | typeof EMPTY;
  why: string;
}

/** One cell a single line settles from the player's (correct) marks. */
export function nextDeduction(p: PixlPuzzle, state: PixlState): Deduction | null {
  const grid = knowledge(state);
  for (const l of allLines(p)) {
    const cur = l.cells.map((i) => grid[i]);
    const next = solveLine(l.clue, cur);
    if (!next) continue;
    const k = next.findIndex((v, j) => v !== cur[j]);
    if (k >= 0) {
      const clue = l.clue.length ? l.clue.join(" ") : "0";
      return { cell: l.cells[k], value: next[k] as Deduction["value"], why: `${l.label}, clue ${clue}: this cell ${next[k] === FILL ? "must be filled" : "stays empty"}.` };
    }
  }
  return null;
}

/** 0..100 from size, line-solver passes and how much of the grid is filled. */
export function grade(p: PixlPuzzle): number {
  const { passes } = lineSolve(p);
  const lines = p.w + p.h;
  const depth = Math.min(1, passes / lines / 6);
  return Math.max(0, Math.min(100, Math.round((p.w - 5) * 7 + depth * 40)));
}

/* ---------------- Generator ---------------- */

/** Seeded symmetric pattern: random left half, mirrored, smoothed into blobs. */
function pattern(w: number, h: number, rng: Rng): number[] {
  const half = Math.ceil(w / 2);
  let cells = new Array(w * h).fill(0);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < half; c++) {
      const v = rng.chance(0.56) ? 1 : 0;
      cells[r * w + c] = v;
      cells[r * w + (w - 1 - c)] = v;
    }
  }
  // One majority smoothing pass keeps shapes chunky, like hand-drawn pixel art.
  const next = cells.slice();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let on = 0, all = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
          all++;
          on += cells[rr * w + cc];
        }
      next[r * w + c] = on * 2 > all ? 1 : on * 2 < all ? 0 : cells[r * w + c];
    }
  }
  cells = next;
  return cells;
}

/**
 * Repairs a pattern the line solver cannot finish: flip a stuck cell (and its mirror) and try again.
 * Small edits keep the symmetric look while making the clues decisive.
 */
function makeDecisive(w: number, h: number, cells: number[], rng: Rng, budget: number): number[] | null {
  for (let k = 0; k <= budget; k++) {
    const p = cluesFor(w, h, cells);
    const { solved, grid } = lineSolve(p);
    if (solved) return cells;
    const stuck = grid.flatMap((v, i) => (v === UNKNOWN ? [i] : []));
    const i = rng.pick(stuck);
    const r = Math.floor(i / w), c = i % w;
    const v = cells[i] ? 0 : 1;
    cells[i] = v;
    cells[r * w + (w - 1 - c)] = v;
  }
  return null;
}

function blankLines(w: number, h: number, cells: number[]) {
  let n = 0;
  for (let r = 0; r < h; r++) if (rowCells({ w }, r).every((i) => !cells[i])) n++;
  for (let c = 0; c < w; c++) if (colCells({ w, h }, c).every((i) => !cells[i])) n++;
  return n;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<PixlPuzzle, PixlSolution> {
  const size = SIZE_FOR[difficulty];
  // Library first (when a picture of this size exists), mirrored at random for variety.
  const lib = ART.map(artCells).filter((a) => a.w === size && a.h === size);
  if (lib.length && rng.chance(0.5)) {
    const a = rng.pick(lib);
    const flip = rng.chance(0.5);
    const cells = flip ? a.cells.map((_, i) => a.cells[Math.floor(i / a.w) * a.w + (a.w - 1 - (i % a.w))]) : a.cells.slice();
    const p = cluesFor(a.w, a.h, cells);
    if (lineSolve(p).solved) return { puzzle: p, solution: cells, grade: grade(p) };
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const raw = pattern(size, size, rng);
    const cells = makeDecisive(size, size, raw, rng, size * 3);
    if (!cells) continue;
    const filled = cells.filter(Boolean).length / cells.length;
    if (filled < 0.3 || filled > 0.75 || blankLines(size, size, cells) > 1) continue;
    const p = cluesFor(size, size, cells);
    return { puzzle: p, solution: cells, grade: grade(p) };
  }
  throw new Error(`pixl: could not generate a ${size}x${size} puzzle`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: PixlPuzzle, state: unknown): state is PixlState {
  return Array.isArray(state) && state.length === p.w * p.h && state.every((v) => v === EMPTY || v === FILL || v === CROSS);
}

export function verify(p: PixlPuzzle, sol: PixlSolution, state: PixlState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const progress = progressOf(p, sol, state);
  if (!analyze(p, state).clear) return { ok: false, progress, reason: "clues not met" };
  const match = sol.every((v, i) => (v === 1) === (state[i] === FILL));
  return match ? { ok: true, progress: 1 } : { ok: false, progress, reason: "valid but not the scheduled picture" };
}

/** (correct fills − wrong fills) / picture size, never below 0. X marks do not count. */
export function progressOf(p: PixlPuzzle, sol: PixlSolution, state: PixlState): number {
  if (!wellFormed(p, state)) return 0;
  const total = sol.filter(Boolean).length;
  if (!total) return 1;
  let score = 0;
  state.forEach((v, i) => {
    if (v === FILL) score += sol[i] ? 1 : -1;
  });
  return Math.max(0, score / total);
}

export function hint(p: PixlPuzzle, sol: PixlSolution, state: PixlState): Hint | null {
  if (!wellFormed(p, state)) return null;
  const wrongFill = state.findIndex((v, i) => v === FILL && !sol[i]);
  if (wrongFill >= 0) return { target: wrongFill, text: "This cell stays empty." };
  const wrongCross = state.findIndex((v, i) => v === CROSS && sol[i]);
  if (wrongCross >= 0) return { target: wrongCross, text: "This X hides a filled cell." };
  if (analyze(p, state).clear) return null;
  const d = nextDeduction(p, state);
  if (d) return { target: d.cell, text: d.why };
  const i = sol.findIndex((v, k) => v && state[k] !== FILL);
  return { target: i, text: "Fill this one." };
}

const logic: GameLogic<PixlPuzzle, PixlSolution, PixlState> = {
  id: "pixl",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
