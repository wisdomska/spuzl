/**
 * Flip Daily and Free play: "Flip the most in one move." You play the light discs. Exactly one legal
 * square flips the most; harder days have more legal squares and closer runners-up.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { flipsFor, initialGrid, legalSquares, place, sqName, type Grid } from "./engine";

export interface FlipPuzzle {
  grid: Grid;
}
export interface FlipSolution {
  sq: number;
  flips: number;
}
export interface FlipState {
  sq: number | null;
}

interface Spec {
  plies: [number, number];
  minMoves: number;
  /** runner-up must be within this many flips of the best */
  margin: number;
  minBest: number;
}
const SPEC: Record<Difficulty, Spec> = {
  easy: { plies: [6, 14], minMoves: 3, margin: 9, minBest: 3 },
  medium: { plies: [14, 24], minMoves: 5, margin: 3, minBest: 4 },
  hard: { plies: [20, 32], minMoves: 7, margin: 2, minBest: 5 },
  expert: { plies: [28, 40], minMoves: 8, margin: 1, minBest: 6 },
  mega: { plies: [36, 48], minMoves: 9, margin: 1, minBest: 7 },
};

export function options(g: Grid) {
  return legalSquares(g, 1).map((sq) => ({ sq, flips: flipsFor(g, sq, 1).length }));
}

export function countSolutions(p: FlipPuzzle, limit = 2): number {
  const o = options(p.grid);
  const best = Math.max(0, ...o.map((x) => x.flips));
  return Math.min(limit, o.filter((x) => x.flips === best && best > 0).length);
}

export function grade(p: FlipPuzzle): number {
  const o = options(p.grid)
    .map((x) => x.flips)
    .sort((a, b) => b - a);
  const gap = o.length > 1 ? o[0] - o[1] : 6;
  const discs = p.grid.filter(Boolean).length;
  return Math.min(100, Math.round(o.length * 2.5 + Math.max(0, 6 - gap) * 4 + discs / 3 + o[0] * 1.5));
}

function playout(rng: Rng, plies: number): Grid | null {
  let g = initialGrid();
  let who = 1;
  for (let i = 0; i < plies; i++) {
    let moves = legalSquares(g, who);
    if (!moves.length) {
      who = 3 - who;
      moves = legalSquares(g, who);
      if (!moves.length) return null;
    }
    g = place(g, rng.pick(moves), who);
    who = 3 - who;
  }
  return who === 1 ? g : null;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<FlipPuzzle, FlipSolution> {
  const s = SPEC[difficulty];
  for (let attempt = 0; attempt < 20000; attempt++) {
    const g = playout(rng, rng.int(s.plies[0], s.plies[1]));
    if (!g) continue;
    const o = options(g).sort((a, b) => b.flips - a.flips);
    if (o.length < s.minMoves || o[0].flips < s.minBest) continue;
    if (o[0].flips === o[1].flips || o[0].flips - o[1].flips > s.margin) continue;
    const puzzle = { grid: g };
    return { puzzle, solution: { sq: o[0].sq, flips: o[0].flips }, grade: grade(puzzle) };
  }
  throw new Error(`flip: could not generate a ${difficulty} puzzle`);
}

const wellFormed = (s: unknown): s is FlipState => !!s && typeof s === "object" && "sq" in s;

export function verify(p: FlipPuzzle, sol: FlipSolution, state: FlipState): VerifyResult {
  if (!wellFormed(state) || !Number.isInteger(state.sq)) return { ok: false, progress: 0, reason: "malformed state" };
  const flips = flipsFor(p.grid, state.sq!, 1).length;
  if (!flips) return { ok: false, progress: 0, reason: "illegal square" };
  if (state.sq !== sol.sq || flips !== sol.flips) return { ok: false, progress: 0, score: flips, reason: "not the biggest flip" };
  return { ok: true, progress: 1, score: flips };
}

export const progress = (p: FlipPuzzle, sol: FlipSolution, state: FlipState) => (verify(p, sol, state).ok ? 1 : 0);

/** First nudges towards the right line count, then names the square. */
export function hint(p: FlipPuzzle, sol: FlipSolution, state: FlipState): Hint | null {
  const picked = wellFormed(state) ? state.sq : null;
  if (picked === sol.sq) return null;
  return { target: sol.sq, text: `Try ${sqName(sol.sq)}. Count every line it closes, diagonals too.` };
}

const logic: GameLogic<FlipPuzzle, FlipSolution, FlipState> = { id: "flip", generate, countSolutions, verify, progress, hint };
export default logic;
