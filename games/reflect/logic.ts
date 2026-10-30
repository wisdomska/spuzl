/**
 * Reflect: one half of a pattern is drawn; complete the mirror half across the axis. Every player
 * cell has exactly one source cell across the axis, so the answer is unique by construction.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

/** v: mirror left to right, h: top to bottom, d: across the main diagonal */
export type Axis = "v" | "h" | "d";
export interface ReflectPuzzle {
  size: number;
  axis: Axis;
  /** number of fill colours (marks cycle 0 → 1 → … → colors → 0) */
  colors: number;
  /** given value per cell, or -1 for a cell the player fills */
  given: number[];
}
export type ReflectSolution = number[];
/** value per cell; only player cells are read */
export type ReflectState = number[];

interface Spec {
  size: number;
  axis: Axis;
  colors: number;
  fill: [number, number];
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { size: 6, axis: "v", colors: 1, fill: [0.35, 0.55] },
  medium: { size: 7, axis: "h", colors: 1, fill: [0.35, 0.55] },
  hard: { size: 7, axis: "v", colors: 2, fill: [0.4, 0.6] },
  expert: { size: 7, axis: "d", colors: 2, fill: [0.4, 0.6] },
  mega: { size: 8, axis: "d", colors: 2, fill: [0.4, 0.6] },
};

/** The cell across the axis. Cells on a diagonal axis mirror onto themselves. */
export function mirrorOf(n: number, axis: Axis, i: number): number {
  const r = Math.floor(i / n), c = i % n;
  if (axis === "v") return r * n + (n - 1 - c);
  if (axis === "h") return (n - 1 - r) * n + c;
  return c * n + r;
}

/** Cells the player fills: the right half, bottom half, or above the diagonal. */
export function isPlayerCell(n: number, axis: Axis, i: number): boolean {
  const r = Math.floor(i / n), c = i % n;
  if (axis === "v") return c >= Math.ceil(n / 2);
  if (axis === "h") return r >= Math.ceil(n / 2);
  return c > r;
}

export const playerCells = (p: ReflectPuzzle) => p.given.flatMap((g, i) => (g < 0 ? [i] : []));

/** Player cells that disagree with their mirror (filled or wrongly left empty is not checked here). */
export function mismatches(p: ReflectPuzzle, state: ReflectState): number[] {
  return playerCells(p).filter((i) => state[i] !== 0 && state[i] !== p.given[mirrorOf(p.size, p.axis, i)]);
}

export function countSolutions(p: ReflectPuzzle, limit = 2): number {
  // Each player cell is forced by its source; inconsistent data (a player cell mirroring a player cell) has none.
  const ok = playerCells(p).every((i) => p.given[mirrorOf(p.size, p.axis, i)] >= 0);
  return ok ? Math.min(1, limit) : 0;
}

export function solve(p: ReflectPuzzle): ReflectSolution {
  return p.given.map((g, i) => (g >= 0 ? g : p.given[mirrorOf(p.size, p.axis, i)]));
}

/* ---------------- Generator ---------------- */

function smooth(n: number, cells: number[], mask: (i: number) => boolean): number[] {
  return cells.map((v, i) => {
    if (!mask(i)) return v;
    const r = Math.floor(i / n), c = i % n;
    let on = 0, all = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const y = r + dr, x = c + dc;
      if ((dr || dc) && y >= 0 && x >= 0 && y < n && x < n && mask(y * n + x)) {
        all++;
        if (cells[y * n + x]) on++;
      }
    }
    return on * 2 > all ? 1 : on * 2 < all ? 0 : v;
  });
}

/** 0..100 from target cell count, colours and axis. */
export function grade(p: ReflectPuzzle): number {
  const sol = solve(p);
  const filled = playerCells(p).filter((i) => sol[i] > 0).length;
  const axisCost = { v: 0, h: 8, d: 22 }[p.axis];
  return Math.max(0, Math.min(100, Math.round(filled * 0.9 + (p.colors - 1) * 18 + axisCost)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<ReflectPuzzle, ReflectSolution> {
  const { size: n, axis, colors, fill } = SPEC[difficulty];
  const source = (i: number) => !isPlayerCell(n, axis, i);
  for (let attempt = 0; attempt < 200; attempt++) {
    let cells: number[] = Array.from({ length: n * n }, (_, i) => (source(i) && rng.chance(0.5) ? 1 : 0));
    cells = smooth(n, cells, source);
    if (rng.chance(0.5)) cells = smooth(n, cells, source);
    const src = cells.filter((v, i) => source(i) && v).length;
    const total = cells.filter((_, i) => source(i)).length;
    if (src < total * fill[0] || src > total * fill[1]) continue;
    // second colour: a few seeded blobs recolour filled cells
    if (colors > 1) {
      const seeds = Array.from({ length: 3 }, () => rng.int(0, n * n - 1));
      cells = cells.map((v, i) => {
        if (!v) return 0;
        const r = Math.floor(i / n), c = i % n;
        const near = seeds.some((s) => Math.abs(Math.floor(s / n) - r) + Math.abs((s % n) - c) <= Math.floor(n / 3));
        return near ? 2 : 1;
      });
      const twos = cells.filter((v) => v === 2).length;
      if (twos < src * 0.2 || twos > src * 0.8) continue;
    }
    const given = cells.map((v, i) => (source(i) ? v : -1));
    const puzzle: ReflectPuzzle = { size: n, axis, colors, given };
    return { puzzle, solution: solve(puzzle), grade: grade(puzzle) };
  }
  throw new Error(`reflect: could not generate a ${difficulty} pattern`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: ReflectPuzzle, state: unknown): state is ReflectState {
  return Array.isArray(state) && state.length === p.size * p.size && state.every((v) => Number.isInteger(v) && v >= 0 && v <= p.colors);
}

/** Correct filled player cells over filled target cells. Empty-correct cells do not count, so nothing leaks. */
export function progress(p: ReflectPuzzle, sol: ReflectSolution, state: ReflectState): number {
  if (!wellFormed(p, state)) return 0;
  const want = playerCells(p).filter((i) => sol[i] > 0);
  if (!want.length) return 1;
  const wrong = playerCells(p).filter((i) => state[i] > 0 && state[i] !== sol[i]).length;
  const good = want.filter((i) => state[i] === sol[i]).length;
  return Math.max(0, (good - wrong) / want.length);
}

export function verify(p: ReflectPuzzle, sol: ReflectSolution, state: ReflectState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const bad = playerCells(p).find((i) => state[i] !== sol[i]);
  return bad === undefined ? { ok: true, progress: 1 } : { ok: false, progress: progress(p, sol, state), reason: "pattern does not mirror" };
}

const NAMES = ["empty", "filled", "second colour"];

export function hint(p: ReflectPuzzle, sol: ReflectSolution, state: ReflectState): Hint | null {
  if (!wellFormed(p, state)) return null;
  const cells = playerCells(p);
  const wrong = cells.find((i) => state[i] > 0 && state[i] !== sol[i]);
  if (wrong !== undefined) return { target: wrong, text: `This cell should be ${NAMES[sol[wrong]]}.` };
  const missing = cells.find((i) => state[i] !== sol[i]);
  if (missing === undefined) return null;
  const r = Math.floor(missing / p.size) + 1, c = (missing % p.size) + 1;
  return { target: missing, text: `Row ${r}, column ${c} mirrors a ${NAMES[sol[missing]]} cell.` };
}

const logic: GameLogic<ReflectPuzzle, ReflectSolution, ReflectState> = {
  id: "reflect",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
