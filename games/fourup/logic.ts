/**
 * Four Up Daily and Free play: "Win in N drops." You are the star disc (seat 0) and move first in
 * the puzzle position. The generator proves a forced win in exactly N drops against every defence,
 * no faster win, and exactly one winning first drop. Later drops accept any column that keeps the
 * forced win. The rival replies with its longest defence (same on client and server).
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { COLS, bestDefence, drop, dropRow, dropWins, emptyGrid, lineThrough, openCols, rivalLost, winIn, winner, winningCols, type Grid } from "./engine";

export interface FourUpPuzzle {
  grid: Grid;
  winIn: number;
}
export interface FourUpSolution {
  /** main line: your drops and rival replies alternating, ending in four */
  line: number[];
}
export interface FourUpState {
  cols: number[];
}

export const WIN_FOR: Record<Difficulty, number> = { easy: 2, medium: 2, hard: 3, expert: 3, mega: 4 };
const DISCS_FOR: Record<Difficulty, [number, number]> = { easy: [6, 12], medium: [10, 18], hard: [10, 18], expert: [14, 22], mega: [12, 22] };

export const COPY = {
  wrong: "That lets them off the hook.",
  full: "That column is full.",
  win: "Four up. You win.",
} as const;

export interface FourReplay {
  grid: Grid;
  /** every drop so far, yours and theirs */
  plies: { col: number; who: number }[];
  good: number;
  won: boolean;
  line: number[] | null;
  wrongAt: number;
  illegal: boolean;
}

export function replay(p: FourUpPuzzle, cols: readonly number[]): FourReplay {
  let g = p.grid.slice();
  const plies: { col: number; who: number }[] = [];
  let good = 0;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (dropRow(g, c) < 0) return { grid: g, plies, good, won: false, line: null, wrongAt: i, illegal: true };
    const left = p.winIn - i - 1;
    const r = dropRow(g, c);
    const wins = dropWins(g, c, 1);
    g = drop(g, c, 1);
    plies.push({ col: c, who: 1 });
    if (wins) return { grid: g, plies, good: good + 1, won: true, line: lineThrough(g, r * COLS + c), wrongAt: -1, illegal: false };
    if (left <= 0 || !rivalLost(g, 1, left)) return { grid: g, plies, good, won: false, line: null, wrongAt: i, illegal: false };
    good++;
    const reply = bestDefence(g, 1, left);
    g = drop(g, reply, 2);
    plies.push({ col: reply, who: 2 });
  }
  return { grid: g, plies, good, won: false, line: null, wrongAt: -1, illegal: false };
}

export function countSolutions(p: FourUpPuzzle, limit = 2): number {
  return Math.min(limit, winningCols(p.grid, 1, p.winIn).length);
}

export function solveLine(p: FourUpPuzzle): number[] {
  let g = p.grid.slice();
  const line: number[] = [];
  for (let left = p.winIn; left > 0; left--) {
    const c = openCols(g).find((x) => dropWins(g, x, 1)) ?? winningCols(g, 1, left)[0];
    line.push(c);
    if (dropWins(g, c, 1)) return line;
    g = drop(g, c, 1);
    const r = bestDefence(g, 1, left - 1);
    line.push(r);
    g = drop(g, r, 2);
  }
  return line;
}

export function grade(p: FourUpPuzzle): number {
  const discs = p.grid.filter(Boolean).length;
  const first = winningCols(p.grid, 1, p.winIn)[0];
  // A first drop that is not itself a block or an open threat is harder to see.
  const blocks = dropWins(p.grid, first, 2);
  return Math.min(100, Math.round([0, 5, 25, 55, 80][p.winIn] + discs / 2 + (blocks ? 0 : 6)));
}

function playout(rng: Rng, discs: number): Grid | null {
  let g = emptyGrid();
  for (let i = 0; i < discs; i++) {
    const who = i % 2 === 0 ? 1 : 2;
    const cols = openCols(g);
    // centre-weighted random play, never completing four
    const weighted = cols.flatMap((c) => Array(4 - Math.abs(3 - c)).fill(c) as number[]);
    const c = rng.pick(weighted);
    if (dropWins(g, c, who)) return null;
    g = drop(g, c, who);
  }
  return g;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<FourUpPuzzle, FourUpSolution> {
  const n = WIN_FOR[difficulty];
  const [lo, hi] = DISCS_FOR[difficulty];
  for (let attempt = 0; attempt < 200000; attempt++) {
    const discs = 2 * rng.int(lo / 2, hi / 2); // even: star to move
    const g = playout(rng, discs);
    if (!g || winner(g)) continue;
    // the rival must not be threatening an immediate four the star cannot meet
    if (n > 1 && winIn(g, 1, n - 1)) continue;
    if (!winIn(g, 1, n)) continue;
    const firsts = winningCols(g, 1, n);
    if (firsts.length !== 1) continue;
    const puzzle = { grid: g, winIn: n };
    return { puzzle, solution: { line: solveLine(puzzle) }, grade: grade(puzzle) };
  }
  throw new Error(`fourup: could not generate a win in ${n}`);
}

const wellFormed = (s: unknown): s is FourUpState => !!s && Array.isArray((s as FourUpState).cols) && (s as FourUpState).cols.length <= 8 && (s as FourUpState).cols.every((c) => Number.isInteger(c));

export function verify(p: FourUpPuzzle, sol: FourUpSolution, state: FourUpState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  if (!state.cols.length || state.cols[0] !== sol.line[0]) return { ok: false, progress: 0, reason: "wrong first drop" };
  const r = replay(p, state.cols);
  const progress = r.won ? 1 : r.good / p.winIn;
  if (r.illegal) return { ok: false, progress, reason: "illegal drop" };
  if (r.wrongAt >= 0) return { ok: false, progress, reason: "drop does not keep the win" };
  if (!r.won) return { ok: false, progress, reason: "incomplete" };
  return { ok: true, progress: 1 };
}

export function progress(p: FourUpPuzzle, sol: FourUpSolution, state: FourUpState): number {
  if (!wellFormed(state)) return 0;
  const r = replay(p, state.cols);
  return r.won ? 1 : r.good / p.winIn;
}

export function hint(p: FourUpPuzzle, sol: FourUpSolution, state: FourUpState): Hint | null {
  const cols = wellFormed(state) ? state.cols : [];
  const r = replay(p, cols);
  if (r.won) return null;
  if (r.illegal || r.wrongAt >= 0) return { target: null, text: "Undo that drop. It lets them off the hook." };
  const left = p.winIn - r.good;
  const c = r.good === 0 ? sol.line[0] : (openCols(r.grid).find((x) => dropWins(r.grid, x, 1)) ?? winningCols(r.grid, 1, left)[0]);
  const now = dropWins(r.grid, c, 1);
  return { target: c, text: now ? `Column ${c + 1} finishes it.` : `Column ${c + 1}. Make two threats at once.` };
}

const logic: GameLogic<FourUpPuzzle, FourUpSolution, FourUpState> = { id: "fourup", generate, countSolutions, verify, progress, hint };
export default logic;
