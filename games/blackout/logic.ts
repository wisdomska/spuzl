/**
 * Blackout: tapping a tile flips it and its four neighbours; turn every light off. Puzzles are built
 * from a press set, so they are always solvable. Par is the true minimum number of taps, found with
 * linear algebra over GF(2): one solution plus every combination of the null space, lightest wins.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export interface BlackoutPuzzle {
  size: number;
  /** 1 lit, 0 off; row-major */
  lights: number[];
  /** fewest taps that clear the board (shown to players) */
  par: number;
}
/** One minimal press set (cell indexes). */
export interface BlackoutSolution {
  presses: number[];
}
/** The tap log, in order. Replayed by the verifier. */
export interface BlackoutState {
  presses: number[];
}

export const SIZE_FOR: Record<Difficulty, number> = { easy: 4, medium: 5, hard: 5, expert: 6, mega: 7 };
const PAR_RANGE: Record<Difficulty, [number, number]> = { easy: [3, 5], medium: [5, 8], hard: [9, 12], expert: [12, 17], mega: [18, 26] };

/* ---------------- Board mechanics ---------------- */

export function neighbourhood(n: number, i: number): number[] {
  const r = Math.floor(i / n),
    c = i % n;
  const out = [i];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

export function press(n: number, lights: number[], i: number): number[] {
  const next = lights.slice();
  for (const j of neighbourhood(n, i)) next[j] ^= 1;
  return next;
}

export function replay(p: BlackoutPuzzle, presses: number[]): number[] {
  let lights = p.lights.slice();
  for (const i of presses) lights = press(p.size, lights, i);
  return lights;
}

export const lit = (lights: number[]) => lights.reduce((a, b) => a + b, 0);

/* ---------------- GF(2) solver ---------------- */

/**
 * All press sets that clear `lights`, described as one particular solution plus a null-space basis.
 * Rows are bit arrays; elimination is plain Gauss-Jordan over GF(2).
 */
export function solveSpace(n: number, lights: number[]): { particular: number[]; basis: number[][] } | null {
  const N = n * n;
  // Augmented matrix: A[j][i] = 1 when pressing i toggles j.
  const m: number[][] = Array.from({ length: N }, (_, j) => {
    const row = new Array<number>(N + 1).fill(0);
    for (const i of neighbourhood(n, j)) row[i] = 1;
    row[N] = lights[j];
    return row;
  });
  const pivotCol: number[] = [];
  let r = 0;
  for (let c = 0; c < N && r < N; c++) {
    let p = r;
    while (p < N && !m[p][c]) p++;
    if (p === N) continue;
    [m[r], m[p]] = [m[p], m[r]];
    for (let k = 0; k < N; k++) {
      if (k !== r && m[k][c]) for (let x = c; x <= N; x++) m[k][x] ^= m[r][x];
    }
    pivotCol.push(c);
    r++;
  }
  for (let k = r; k < N; k++) if (m[k][N]) return null;
  const isPivot = new Set(pivotCol);
  const free = Array.from({ length: N }, (_, c) => c).filter((c) => !isPivot.has(c));
  const particular = new Array<number>(N).fill(0);
  pivotCol.forEach((c, k) => (particular[c] = m[k][N]));
  const basis = free.map((f) => {
    const v = new Array<number>(N).fill(0);
    v[f] = 1;
    pivotCol.forEach((c, k) => (v[c] = m[k][f]));
    return v;
  });
  return { particular, basis };
}

/** A minimal press set for `lights`, or null when unsolvable. */
export function minimalPresses(n: number, lights: number[]): number[] | null {
  const s = solveSpace(n, lights);
  if (!s) return null;
  let best = s.particular;
  let bestW = lit(best);
  const k = s.basis.length;
  for (let mask = 1; mask < 1 << k; mask++) {
    const v = s.particular.slice();
    for (let b = 0; b < k; b++) if (mask & (1 << b)) for (let i = 0; i < v.length; i++) v[i] ^= s.basis[b][i];
    const w = lit(v);
    if (w < bestW) {
      best = v;
      bestW = w;
    }
  }
  return best.flatMap((v, i) => (v ? [i] : []));
}

/* ---------------- Generator and grader ---------------- */

/** 0..100 from board size and par relative to the board. */
export function grade(p: BlackoutPuzzle): number {
  return Math.max(0, Math.min(100, Math.round((p.size - 4) * 12 + (p.par / (p.size * p.size)) * 90)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<BlackoutPuzzle, BlackoutSolution> {
  const n = SIZE_FOR[difficulty];
  const [lo, hi] = PAR_RANGE[difficulty];
  for (let attempt = 0; attempt < 500; attempt++) {
    const k = rng.int(lo, Math.min(hi + 3, n * n));
    const presses = rng.shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, k);
    let lights = new Array<number>(n * n).fill(0);
    for (const i of presses) lights = press(n, lights, i);
    if (!lit(lights)) continue;
    const min = minimalPresses(n, lights)!;
    if (min.length < lo || min.length > hi) continue;
    const puzzle = { size: n, lights, par: min.length };
    return { puzzle, solution: { presses: min }, grade: grade(puzzle) };
  }
  throw new Error(`blackout: could not generate a ${n}x${n} board`);
}

/* ---------------- Verification ---------------- */

function pressesOf(p: BlackoutPuzzle, state: unknown): number[] | null {
  const ps = (state as BlackoutState | null)?.presses;
  if (!Array.isArray(ps) || ps.length > 2000 || !ps.every((i) => Number.isInteger(i) && i >= 0 && i < p.size * p.size)) return null;
  return ps;
}

export function verify(p: BlackoutPuzzle, _sol: BlackoutSolution, state: BlackoutState): VerifyResult {
  const ps = pressesOf(p, state);
  if (!ps) return { ok: false, progress: 0, reason: "malformed state" };
  const lights = replay(p, ps);
  if (lit(lights)) return { ok: false, progress: progressOf(p, _sol, state), reason: "lights still on" };
  return { ok: true, progress: 1 };
}

/** Share of the par distance already covered: 1 − (taps still needed / par). */
export function progressOf(p: BlackoutPuzzle, _sol: BlackoutSolution, state: BlackoutState): number {
  const ps = pressesOf(p, state);
  if (!ps) return 0;
  const left = minimalPresses(p.size, replay(p, ps))!.length;
  return Math.max(0, Math.min(1, 1 - left / Math.max(1, p.par)));
}

export function hint(p: BlackoutPuzzle, _sol: BlackoutSolution, state: BlackoutState): Hint | null {
  const ps = pressesOf(p, state);
  if (!ps) return null;
  const min = minimalPresses(p.size, replay(p, ps))!;
  if (!min.length) return null;
  const i = min[0];
  return {
    target: i,
    text: `Tap row ${Math.floor(i / p.size) + 1}, column ${(i % p.size) + 1}. ${min.length} ${min.length === 1 ? "tap" : "taps"} left at best.`,
  };
}

const logic: GameLogic<BlackoutPuzzle, BlackoutSolution, BlackoutState> = {
  id: "blackout",
  generate,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
