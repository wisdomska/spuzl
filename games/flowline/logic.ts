/**
 * Flowline: rotate pipe tiles so water from the source reaches every plant.
 * Every pipe must join up: no open ends, no loops, one network from the source (a spanning tree).
 * Plants are the dead-end tiles. Generator: random spanning tree (Wilson), scrambled rotations, and a
 * constraint solver over tile orientations that locks tiles until the orientation set is unique.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { BIT, DIR_NAME, neighbours, opposite, step } from "@/games/_shared/grid";

export interface FlowlinePuzzle {
  rows: number;
  cols: number;
  /** pipe mask per cell as dealt (N 1, E 2, S 4, W 8), row-major */
  tiles: number[];
  source: number;
  /** dead-end tiles that need water */
  plants: number[];
  /** tiles already in place; they cannot turn */
  locked: number[];
}
/** solved pipe mask per cell */
export type FlowlineSolution = number[];
/** clockwise quarter turns applied to each dealt tile, 0..3 */
export type FlowlineState = number[];

export const SHAPE_FOR: Record<Difficulty, { rows: number; cols: number }> = {
  easy: { rows: 5, cols: 6 },
  medium: { rows: 6, cols: 6 },
  hard: { rows: 7, cols: 6 },
  expert: { rows: 7, cols: 7 },
  mega: { rows: 8, cols: 7 },
};
const MAX_LOCKS: Record<Difficulty, number> = { easy: 3, medium: 3, hard: 4, expert: 4, mega: 5 };

/** Rotate a mask clockwise by r quarter turns. */
export function rotate(mask: number, r: number): number {
  let m = mask & 15;
  for (let k = 0; k < ((r % 4) + 4) % 4; k++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

const popcount = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

/** Distinct masks a tile can show. */
export function orientations(mask: number): number[] {
  return [...new Set([0, 1, 2, 3].map((r) => rotate(mask, r)))];
}

export const masksOf = (p: FlowlinePuzzle, state: FlowlineState) => p.tiles.map((t, i) => rotate(t, state[i] ?? 0));

export interface FlowAnalysis {
  /** cells reached by water */
  lit: Set<number>;
  /** BFS distance from the source for lit cells (drives the water pulse) */
  dist: Map<number, number>;
  /** cells with an open end that meets nothing */
  leaks: Set<number>;
  plantsLit: number;
  solved: boolean;
}

/** Water flows from the source through joined pipes. Solved: every cell lit, no open ends. */
export function analyze(p: FlowlinePuzzle, masks: number[]): FlowAnalysis {
  const { rows, cols } = p;
  const leaks = new Set<number>();
  for (let i = 0; i < rows * cols; i++) {
    for (let d = 0; d < 4; d++) {
      if (!(masks[i] & BIT[d])) continue;
      const j = step(rows, cols, i, d);
      if (j < 0 || !(masks[j] & BIT[opposite(d)])) leaks.add(i);
    }
  }
  const dist = new Map<number, number>([[p.source, 0]]);
  const queue = [p.source];
  while (queue.length) {
    const i = queue.shift()!;
    for (let d = 0; d < 4; d++) {
      if (!(masks[i] & BIT[d])) continue;
      const j = step(rows, cols, i, d);
      if (j >= 0 && masks[j] & BIT[opposite(d)] && !dist.has(j)) {
        dist.set(j, dist.get(i)! + 1);
        queue.push(j);
      }
    }
  }
  const lit = new Set(dist.keys());
  const plantsLit = p.plants.filter((x) => lit.has(x)).length;
  return { lit, dist, leaks, plantsLit, solved: lit.size === rows * cols && leaks.size === 0 };
}

/* ---------------- Solver ---------------- */

/**
 * Enumerates up to `limit` orientation sets. Domains are 16-bit sets of masks; propagation agrees each
 * shared edge, a union-find rejects loops and closed-off pieces, then it branches on the tightest tile.
 */
export function solveAll(p: FlowlinePuzzle, limit: number, budget = 200_000): { solutions: number[][]; exhausted: boolean } {
  const { rows, cols } = p;
  const N = rows * cols;
  const locked = new Set(p.locked);
  const init = p.tiles.map((t, i) => (locked.has(i) ? 1 << t : orientations(t).reduce((s, m) => s | (1 << m), 0)));
  const nbr = Array.from({ length: N }, (_, i) => [0, 1, 2, 3].map((d) => step(rows, cols, i, d)));
  // canOpen[dom][d], canClose[dom][d] would be 64K entries; compute on the fly with small helpers
  const any = (dom: number, d: number, open: boolean) => {
    for (let m = 0; m < 16; m++) if (dom & (1 << m) && !!(m & BIT[d]) === open) return true;
    return false;
  };
  const keep = (dom: number, d: number, open: boolean) => {
    let out = 0;
    for (let m = 0; m < 16; m++) if (dom & (1 << m) && !!(m & BIT[d]) === open) out |= 1 << m;
    return out;
  };
  const solutions: number[][] = [];
  let nodes = 0;
  let exhausted = false;

  const propagate = (dom: number[]): boolean => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < N; i++) {
        for (let d = 0; d < 4; d++) {
          const j = nbr[i][d];
          let next = dom[i];
          if (j < 0) next = keep(next, d, false);
          else {
            const o = opposite(d);
            if (!any(dom[j], o, true)) next = keep(next, d, false);
            if (!any(dom[j], o, false)) next = keep(next, d, true);
          }
          if (next !== dom[i]) {
            if (!next) return false;
            dom[i] = next;
            changed = true;
          }
        }
      }
    }
    return true;
  };

  /** forced-open edges must not form a loop; a finished piece must be the whole board */
  const structureOk = (dom: number[]): boolean => {
    const parent = Array.from({ length: N }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (let i = 0; i < N; i++) {
      for (const d of [1, 2]) {
        const j = nbr[i][d];
        if (j < 0 || any(dom[i], d, false)) continue;
        const a = find(i),
          b = find(j);
        if (a === b) return false;
        parent[a] = b;
      }
    }
    // a component with no undecided edge leaving it is closed; only the whole board may be closed
    const open = new Map<number, boolean>();
    const size = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const r = find(i);
      size.set(r, (size.get(r) ?? 0) + 1);
      if (!open.get(r)) {
        for (let d = 0; d < 4; d++) {
          const j = nbr[i][d];
          if (j >= 0 && find(j) !== r && any(dom[i], d, true)) {
            open.set(r, true);
            break;
          }
        }
      }
    }
    for (const [r, s] of size) if (!open.get(r) && s < N) return false;
    return true;
  };

  const rec = (dom: number[]) => {
    if (solutions.length >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    if (!propagate(dom) || !structureOk(dom)) return;
    let best = -1,
      bestCount = 99;
    for (let i = 0; i < N; i++) {
      const cnt = bits(dom[i]);
      if (cnt > 1 && cnt < bestCount) [best, bestCount] = [i, cnt];
    }
    if (best < 0) {
      solutions.push(dom.map((x) => 31 - Math.clz32(x)));
      return;
    }
    for (let m = 0; m < 16; m++) {
      if (!(dom[best] & (1 << m))) continue;
      const next = dom.slice();
      next[best] = 1 << m;
      rec(next);
      if (solutions.length >= limit || exhausted) return;
    }
  };
  rec(init);
  return { solutions, exhausted };
}

function bits(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Number of distinct solved layouts, up to `limit`. Running out of budget reports `limit`. */
export function countSolutions(p: FlowlinePuzzle, limit = 2): number {
  const { solutions, exhausted } = solveAll(p, limit);
  return exhausted ? limit : solutions.length;
}

/* ---------------- Grader ---------------- */

/** Difficulty 0..100: board size, share of junctions (T and cross tiles), fewer locks is harder. */
export function grade(p: FlowlinePuzzle, sol: FlowlineSolution = p.tiles): number {
  const N = p.rows * p.cols;
  const junctions = sol.filter((m) => popcount(m) >= 3).length / N;
  const g = (N - 25) * 1.4 + 20 + junctions * 60 - p.locked.length * 3;
  return Math.max(0, Math.min(100, Math.round(g)));
}

/* ---------------- Generator ---------------- */

/** Uniform random spanning tree by Wilson's algorithm; returns pipe masks. */
function spanningTree(rows: number, cols: number, rng: Rng): number[] {
  const N = rows * cols;
  const inTree = new Array<boolean>(N).fill(false);
  const next = new Array<number>(N).fill(-1);
  const masks = new Array<number>(N).fill(0);
  inTree[rng.int(0, N - 1)] = true;
  for (const start of rng.shuffle(Array.from({ length: N }, (_, i) => i))) {
    let u = start;
    while (!inTree[u]) {
      const nb = neighbours(rows, cols, u);
      next[u] = nb[rng.int(0, nb.length - 1)];
      u = next[u];
    }
    u = start;
    while (!inTree[u]) {
      inTree[u] = true;
      const v = next[u];
      for (let d = 0; d < 4; d++) {
        if (step(rows, cols, u, d) === v) {
          masks[u] |= BIT[d];
          masks[v] |= BIT[opposite(d)];
        }
      }
      u = v;
    }
  }
  return masks;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<FlowlinePuzzle, FlowlineSolution> {
  const { rows, cols } = SHAPE_FOR[difficulty];
  let best: Generated<FlowlinePuzzle, FlowlineSolution> | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const sol = spanningTree(rows, cols, rng);
    // the source sits on a straight or bend tile so it reads clearly
    const candidates = sol.map((m, i) => (popcount(m) === 2 ? i : -1)).filter((i) => i >= 0);
    const source = candidates.length ? rng.pick(candidates) : 0;
    const plants = sol.map((m, i) => (popcount(m) === 1 && i !== source ? i : -1)).filter((i) => i >= 0);
    const tiles = sol.map((m) => {
      const o = orientations(m);
      return o.length === 1 ? m : rotate(m, rng.int(1, 3));
    });
    const locked: number[] = [];
    let unique = false;
    for (let fix = 0; fix <= MAX_LOCKS[difficulty] + 2; fix++) {
      const puzzle = { rows, cols, tiles: tiles.slice(), source, plants, locked: locked.slice().sort((a, b) => a - b) };
      for (const i of locked) puzzle.tiles[i] = sol[i];
      const { solutions, exhausted } = solveAll(puzzle, 2);
      if (exhausted) break;
      if (solutions.length === 1) {
        unique = true;
        break;
      }
      const alt = solutions.find((s) => s.some((m, i) => m !== sol[i]))!;
      const diffs = alt.map((m, i) => (m !== sol[i] ? i : -1)).filter((i) => i >= 0);
      locked.push(rng.pick(diffs));
    }
    if (!unique) continue;
    locked.sort((a, b) => a - b);
    for (const i of locked) tiles[i] = sol[i];
    const puzzle: FlowlinePuzzle = { rows, cols, tiles, source, plants, locked };
    const g = { puzzle, solution: sol, grade: grade(puzzle, sol) };
    if (locked.length <= MAX_LOCKS[difficulty]) return g;
    if (!best || locked.length < best.puzzle.locked.length) best = g;
  }
  if (best) return best;
  throw new Error(`flowline: could not generate a unique ${rows}x${cols} puzzle`);
}

/* ---------------- Verification ---------------- */

function isState(p: FlowlinePuzzle, state: unknown): state is FlowlineState {
  return Array.isArray(state) && state.length === p.rows * p.cols && state.every((v) => Number.isInteger(v) && v >= 0 && v <= 3);
}

/** Share of turnable tiles in their solved orientation. Counts only, never positions. */
function progressOf(p: FlowlinePuzzle, sol: FlowlineSolution, state: FlowlineState): number {
  if (!isState(p, state)) return 0;
  const locked = new Set(p.locked);
  const masks = masksOf(p, state);
  let total = 0,
    right = 0;
  sol.forEach((m, i) => {
    if (locked.has(i)) return;
    total++;
    if (masks[i] === m) right++;
  });
  return total ? right / total : 1;
}

export function verify(p: FlowlinePuzzle, sol: FlowlineSolution, state: FlowlineState): VerifyResult {
  if (!isState(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const masks = masksOf(p, state);
  if (p.locked.some((i) => masks[i] !== p.tiles[i])) return { ok: false, progress: 0, reason: "locked tile turned" };
  const progress = progressOf(p, sol, state);
  const a = analyze(p, masks);
  if (!a.solved) return { ok: false, progress, reason: a.leaks.size ? "open ends" : "not connected" };
  return masks.every((m, i) => m === sol[i])
    ? { ok: true, progress: 1 }
    : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

/** Turns one tile into place, nearest the source first, so the water creeps outwards. */
export function hint(p: FlowlinePuzzle, sol: FlowlineSolution, state: FlowlineState): Hint | null {
  const masks = isState(p, state) ? masksOf(p, state) : p.tiles.slice();
  const order = analyze(p, sol).dist;
  const wrong = [...order.keys()].filter((i) => masks[i] !== sol[i]);
  if (!wrong.length) return null;
  const i = wrong[0];
  const dirs = [0, 1, 2, 3].filter((d) => sol[i] & BIT[d]).map((d) => DIR_NAME[d]);
  return { target: i, text: `Turn this pipe to open ${dirs.join(" and ")}.` };
}

/** Quarter turns that bring a dealt tile to the target mask (0..3), or -1. */
export function turnsTo(tile: number, target: number): number {
  for (let r = 0; r < 4; r++) if (rotate(tile, r) === target) return r;
  return -1;
}

const logic: GameLogic<FlowlinePuzzle, FlowlineSolution, FlowlineState> = {
  id: "flowline",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
