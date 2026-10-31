/**
 * Dead On: six numbers and a target. Combine two tiles with + − × ÷ into a new tile, each number once,
 * whole numbers only. Score by distance to the target (time breaks ties on the leaderboard).
 * The generator only keeps targets the solver can reach exactly; the solver also finds the closest
 * reachable value so scoring is graded against the best possible answer.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export type Op = "+" | "-" | "*" | "/";
export const OPS: Op[] = ["+", "-", "*", "/"];
export const OP_GLYPH: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export interface DeadOnPuzzle {
  /** the six starting numbers, tile ids 0..5 */
  numbers: number[];
  target: number;
}
/** [left tile id, op, right tile id]; step k creates tile id numbers.length + k */
export type Step = [number, Op, number];
export interface DeadOnSolution {
  /** best value reachable (always the target for generated puzzles) */
  best: number;
  /** one shortest exact route, as steps over tile ids */
  steps: Step[];
}
export interface DeadOnState {
  steps: Step[];
}

export const LARGE = [25, 50, 75, 100];
export const MAX_SCORE = 1000;

export type StepBreak = "fraction" | "zero" | "used" | "same" | "op";
export const BREAK_COPY: Record<StepBreak, string> = {
  fraction: "No fractions. That does not divide evenly.",
  zero: "You cannot divide by zero.",
  used: "That tile is already used.",
  same: "Pick two different tiles.",
  op: "Pick + − × or ÷.",
};

export function apply(a: number, op: Op, b: number): { value: number } | { error: StepBreak } {
  switch (op) {
    case "+":
      return { value: a + b };
    case "-":
      return { value: a - b };
    case "*":
      return { value: a * b };
    case "/":
      if (b === 0) return { error: "zero" };
      if (a % b !== 0) return { error: "fraction" };
      return { value: a / b };
    default:
      return { error: "op" };
  }
}

export interface Replay {
  /** value per tile id, created tiles included */
  values: number[];
  /** tile ids still on the board */
  live: number[];
  error: StepBreak | null;
  /** index of the failing step */
  at: number;
}

/** Replays a move log. Stops at the first illegal step. */
export function replay(p: DeadOnPuzzle, steps: Step[]): Replay {
  const values = p.numbers.slice();
  const used = new Set<number>();
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    const fail = (error: StepBreak): Replay => ({ values, live: liveOf(values, used), error, at: k });
    if (!Array.isArray(s) || s.length !== 3) return fail("op");
    const [a, op, b] = s;
    if (!OPS.includes(op)) return fail("op");
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= values.length || b >= values.length) return fail("used");
    if (a === b) return fail("same");
    if (used.has(a) || used.has(b)) return fail("used");
    const r = apply(values[a], op, values[b]);
    if ("error" in r) return fail(r.error);
    used.add(a);
    used.add(b);
    values.push(r.value);
  }
  return { values, live: liveOf(values, used), error: null, at: -1 };
}
const liveOf = (values: number[], used: Set<number>) => values.map((_, i) => i).filter((i) => !used.has(i));

/** Closest live value to the target (ties go to the smaller value). */
export function closest(p: DeadOnPuzzle, r: Replay): number {
  let best = r.values[r.live[0]];
  for (const i of r.live) {
    const v = r.values[i];
    const d = Math.abs(v - p.target),
      bd = Math.abs(best - p.target);
    if (d < bd || (d === bd && v < best)) best = v;
  }
  return best;
}

/* ---------------- Solver ---------------- */

const key = (nums: number[]) =>
  nums
    .slice()
    .sort((x, y) => x - y)
    .join(",");

/**
 * Every value reachable from the numbers, with the fewest operations needed.
 * Searches positive whole intermediates only (a negative or zero tile never reaches a value a
 * positive route cannot), skipping identical multisets.
 */
export function reachable(numbers: number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const n of numbers) out.set(n, 0);
  const seen = new Map<string, number>();
  const rec = (nums: number[], depth: number) => {
    const k = key(nums);
    const prior = seen.get(k);
    if (prior !== undefined && prior <= depth) return;
    seen.set(k, depth);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = Math.max(nums[i], nums[j]),
          b = Math.min(nums[i], nums[j]);
        const results = [a + b];
        if (a !== b) results.push(a - b);
        if (b !== 1) results.push(a * b);
        if (b !== 1 && a % b === 0) results.push(a / b);
        const rest = nums.filter((_, x) => x !== i && x !== j);
        for (const v of results) {
          const d = out.get(v);
          if (d === undefined || d > depth + 1) out.set(v, depth + 1);
          if (rest.length) rec([...rest, v], depth + 1);
        }
      }
    }
  };
  rec(numbers.slice(), 0);
  return out;
}

/** Best value reachable from the numbers for this target. */
export function bestReachable(numbers: number[], target: number): number {
  let best = numbers[0];
  for (const v of reachable(numbers).keys()) {
    const d = Math.abs(v - target),
      bd = Math.abs(best - target);
    if (d < bd || (d === bd && v < best)) best = v;
  }
  return best;
}

/**
 * Shortest exact route from the given live tiles to the target, as steps over tile ids
 * (new tiles numbered from `nextId`). Iterative deepening keeps the route short.
 */
export function route(values: number[], live: number[], target: number, maxDepth = live.length - 1): Step[] | null {
  if (live.some((i) => values[i] === target)) return [];
  for (let limit = 1; limit <= maxDepth; limit++) {
    const failed = new Set<string>();
    const path: Step[] = [];
    const rec = (tiles: [number, number][], nextId: number, left: number): boolean => {
      const k = `${left}|${key(tiles.map((t) => t[1]))}`;
      if (failed.has(k)) return false;
      for (let i = 0; i < tiles.length; i++) {
        for (let j = 0; j < tiles.length; j++) {
          if (i === j) continue;
          const [ia, a] = tiles[i],
            [ib, b] = tiles[j];
          for (const op of OPS) {
            if ((op === "+" || op === "*") && i > j) continue;
            if (op === "-" && a <= b) continue;
            if (op === "/" && (b <= 1 || a % b)) continue;
            if (op === "*" && (a === 1 || b === 1)) continue;
            const v = (apply(a, op, b) as { value: number }).value;
            path.push([ia, op, ib]);
            if (v === target) return true;
            if (left > 1) {
              const rest = tiles.filter((_, x) => x !== i && x !== j);
              if (rest.length && rec([...rest, [nextId, v]], nextId + 1, left - 1)) return true;
            }
            path.pop();
          }
        }
      }
      failed.add(k);
      return false;
    };
    if (
      rec(
        live.map((i) => [i, values[i]]),
        values.length,
        limit,
      )
    )
      return path;
  }
  return null;
}

/* ---------------- Generator + grader ---------------- */

interface Spec {
  large: [number, number];
  target: [number, number];
  minOps: number;
}
const SPEC: Record<Difficulty, Spec> = {
  easy: { large: [2, 2], target: [101, 300], minOps: 2 },
  medium: { large: [1, 2], target: [150, 500], minOps: 3 },
  hard: { large: [1, 1], target: [300, 700], minOps: 3 },
  expert: { large: [0, 1], target: [400, 900], minOps: 4 },
  mega: { large: [1, 2], target: [700, 999], minOps: 4 },
};

/** 0..100 from the shortest route length, the target size and how few targets nearby are reachable. */
export function grade(p: DeadOnPuzzle, reach = reachable(p.numbers)): number {
  const ops = reach.get(p.target) ?? 5;
  let near = 0;
  for (let t = p.target - 10; t <= p.target + 10; t++) if (reach.has(t)) near++;
  const sparse = 1 - near / 21;
  return Math.max(0, Math.min(100, Math.round((ops - 1) * 16 + (p.target / 1000) * 20 + sparse * 30)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<DeadOnPuzzle, DeadOnSolution> {
  const spec = SPEC[difficulty];
  for (let attempt = 0; attempt < 200; attempt++) {
    const nLarge = rng.int(spec.large[0], spec.large[1]);
    const large = rng.shuffle(LARGE.slice()).slice(0, nLarge);
    const smallPool = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const numbers = rng.shuffle([...large, ...smallPool.slice(0, 6 - nLarge)]);
    const reach = reachable(numbers);
    // candidate targets in range that need at least minOps operations
    const fits: number[] = [];
    for (const [v, d] of reach) if (v >= spec.target[0] && v <= spec.target[1] && d >= spec.minOps) fits.push(v);
    if (!fits.length) continue;
    fits.sort((x, y) => x - y);
    const target = rng.pick(fits);
    const puzzle = { numbers, target };
    const steps = route(
      numbers,
      numbers.map((_, i) => i),
      target,
    )!;
    return { puzzle, solution: { best: target, steps }, grade: grade(puzzle, reach) };
  }
  throw new Error(`deadon: could not generate a ${difficulty} puzzle`);
}

/* ---------------- Verification ---------------- */

const wellFormed = (s: unknown): s is DeadOnState =>
  !!s && typeof s === "object" && Array.isArray((s as DeadOnState).steps) && (s as DeadOnState).steps.length <= 5;

/** Score: 1000 minus how far you finished from the best reachable value. */
export function scoreFor(p: DeadOnPuzzle, sol: DeadOnSolution, value: number): number {
  const gap = Math.abs(value - p.target) - Math.abs(sol.best - p.target);
  return Math.max(0, MAX_SCORE - Math.max(0, gap));
}

export function progress(p: DeadOnPuzzle, sol: DeadOnSolution, state: DeadOnState): number {
  if (!wellFormed(state)) return 0;
  const r = replay(p, state.steps);
  if (r.error) return 0;
  const d = Math.abs(closest(p, r) - p.target);
  return Math.max(0, Math.min(1, 1 - d / p.target));
}

export function verify(p: DeadOnPuzzle, sol: DeadOnSolution, state: DeadOnState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const r = replay(p, state.steps);
  if (r.error) return { ok: false, progress: 0, reason: `illegal step ${r.at + 1}: ${r.error}` };
  const value = closest(p, r);
  return { ok: true, progress: progress(p, sol, state), score: scoreFor(p, sol, value) };
}

export function hint(p: DeadOnPuzzle, sol: DeadOnSolution, state: DeadOnState | undefined): Hint | null {
  // before the first move the shell has no state yet: hint from the empty board
  if (state === undefined) state = { steps: [] };
  if (!wellFormed(state)) return null;
  const r = replay(p, state.steps);
  if (r.error) return null;
  if (r.live.some((i) => r.values[i] === p.target)) return null;
  const path = route(r.values, r.live, p.target);
  if (!path) return { target: { undo: true }, text: "The target is out of reach from here. Undo a step." };
  const [a, op, b] = path[0];
  return { target: { tiles: [a, b], op }, text: `Try ${r.values[a]} ${OP_GLYPH[op]} ${r.values[b]}.` };
}

const logic: GameLogic<DeadOnPuzzle, DeadOnSolution, DeadOnState> = {
  id: "deadon",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
