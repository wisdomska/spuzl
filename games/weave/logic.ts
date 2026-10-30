/**
 * Weave: draw one path through the numbered cells 1..m in order, filling every cell.
 * The path moves orthogonally, never crosses a wall and ends on the highest number.
 * Generator: random Hamiltonian path (backbite), then clues and walls are added until the
 * path is the only solution, proven by an exhaustive solver with parity, connectivity and dead-end pruning.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { adjacent, edgeKey, neighbours, randomHamiltonianPath } from "@/games/_shared/grid";

export interface WeavePuzzle {
  size: number;
  /** clue number per cell (row-major), 0 when the cell has no number. 1 is the start, the max is the end. */
  clues: number[];
  /** walls between orthogonally adjacent cells, as [a, b] cell pairs */
  walls: [number, number][];
}
/** cell order of the unique path */
export type WeaveSolution = number[];
/** the player's path so far, as cell indexes in order */
export type WeaveState = number[];

export const SIZE_FOR: Record<Difficulty, number> = { easy: 6, medium: 7, hard: 7, expert: 8, mega: 8 };
/** share of cells that start with a number (before uniqueness repairs add more) */
const CLUE_SHARE: Record<Difficulty, number> = { easy: 0.2, medium: 0.12, hard: 0.08, expert: 0.07, mega: 0.05 };
/** chance a uniqueness repair uses a wall rather than a number */
const WALL_RATE: Record<Difficulty, number> = { easy: 0.25, medium: 0.4, hard: 0.55, expert: 0.6, mega: 0.65 };
const MAX_CLUES: Record<Difficulty, number> = { easy: 14, medium: 14, hard: 13, expert: 14, mega: 13 };

export type WeaveBreak = "order" | "wall" | "early-end" | "revisit" | "jump";
export const RULE_COPY: Record<WeaveBreak, string> = {
  order: "Numbers go in order.",
  wall: "Walls block the path.",
  "early-end": "Fill every cell before the last number.",
  revisit: "The path cannot cross itself.",
  jump: "Move one cell at a time.",
};

export const maxClue = (p: WeavePuzzle) => p.clues.reduce((m, v) => Math.max(m, v), 0);
export const wallSet = (p: WeavePuzzle) => new Set(p.walls.map(([a, b]) => edgeKey(a, b)));

/**
 * Can `path` legally take one more step into `to`? Returns the broken rule, or null when the step is fine.
 * `walls` and `top` are passed in by hot callers to avoid recomputing them.
 */
export function stepError(p: WeavePuzzle, path: WeaveState, to: number, walls = wallSet(p), top = maxClue(p)): WeaveBreak | null {
  const n = p.size;
  const N = n * n;
  if (to < 0 || to >= N) return "jump";
  if (path.length === 0) return p.clues[to] === 1 ? null : "order";
  const head = path[path.length - 1];
  if (!adjacent(n, head, to)) return "jump";
  if (path.includes(to)) return "revisit";
  if (walls.has(edgeKey(head, to))) return "wall";
  const want = nextClue(p, path);
  const c = p.clues[to];
  if (c && c !== want) return "order";
  if (c === top && path.length + 1 !== N) return "early-end";
  return null;
}

/** The next number the path must reach. */
export function nextClue(p: WeavePuzzle, path: WeaveState): number {
  let k = 0;
  for (const i of path) if (p.clues[i]) k = p.clues[i];
  return k + 1;
}

/** Full check of a path. `complete` means it is a valid finished solution. */
export function checkPath(p: WeavePuzzle, path: WeaveState): { valid: boolean; complete: boolean; error: WeaveBreak | null; at: number } {
  const walls = wallSet(p), top = maxClue(p);
  for (let k = 0; k < path.length; k++) {
    const e = stepError(p, path.slice(0, k), path[k], walls, top);
    if (e) return { valid: false, complete: false, error: e, at: k };
  }
  const complete = path.length === p.size * p.size && p.clues[path[path.length - 1]] === top;
  return { valid: true, complete, error: null, at: -1 };
}

/* ---------------- Solver ---------------- */

interface SolveOpts {
  limit: number;
  /** node budget; when exhausted the search reports `exhausted` */
  budget?: number;
}

/** Enumerates up to `limit` solutions. `exhausted` means the budget ran out before the search finished. */
export function solveAll(p: WeavePuzzle, { limit, budget = 400_000 }: SolveOpts): { solutions: number[][]; exhausted: boolean } {
  const n = p.size, N = n * n;
  const top = maxClue(p);
  const walls = wallSet(p);
  const start = p.clues.indexOf(1);
  const end = p.clues.indexOf(top);
  const solutions: number[][] = [];
  if (start < 0 || end < 0) return { solutions, exhausted: false };
  // open neighbours (no wall) per cell
  const nb: number[][] = Array.from({ length: N }, (_, i) => neighbours(n, n, i).filter((j) => !walls.has(edgeKey(i, j))));
  const color = (i: number) => (Math.floor(i / n) + (i % n)) & 1;
  const visited = new Uint8Array(N);
  const left = [0, 0];
  for (let i = 0; i < N; i++) left[color(i)]++;
  const path: number[] = [];
  let nodes = 0;
  let exhausted = false;
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);

  const feasible = (head: number): boolean => {
    const k = N - path.length;
    if (k === 0) return true;
    // parity: remaining cells alternate colours starting with the opposite of the head
    const ch = color(head);
    if (left[1 - ch] !== Math.ceil(k / 2) || left[ch] !== Math.floor(k / 2)) return false;
    if (color(end) !== ((k - 1) % 2 === 0 ? 1 - ch : ch)) return false;
    // connectivity from head through unvisited cells, plus dead-end detection
    seen.fill(0);
    let sp = 0, reached = 0;
    stack[sp++] = head;
    seen[head] = 1;
    while (sp) {
      const i = stack[--sp];
      for (const j of nb[i]) {
        if (visited[j] || seen[j]) continue;
        seen[j] = 1;
        reached++;
        stack[sp++] = j;
      }
    }
    if (reached !== k) return false;
    for (let u = 0; u < N; u++) {
      if (visited[u]) continue;
      let deg = 0;
      for (const j of nb[u]) if (!visited[j] || j === head) deg++;
      if (u === end ? deg < 1 : deg < 2) return false;
    }
    return true;
  };

  const rec = (want: number) => {
    if (solutions.length >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    const head = path[path.length - 1];
    if (path.length === N) {
      if (head === end) solutions.push(path.slice());
      return;
    }
    if (!feasible(head)) return;
    const opts: number[] = [];
    for (const j of nb[head]) {
      if (visited[j]) continue;
      const c = p.clues[j];
      if (c && c !== want) continue;
      if (c === top && path.length + 1 !== N) continue;
      opts.push(j);
    }
    // Warnsdorff: fewest onward moves first, finds solutions quickly
    if (opts.length > 1) {
      const deg = (j: number) => nb[j].reduce((s, x) => s + (visited[x] ? 0 : 1), 0);
      opts.sort((a, b) => deg(a) - deg(b));
    }
    for (const j of opts) {
      visited[j] = 1;
      left[color(j)]--;
      path.push(j);
      rec(p.clues[j] ? want + 1 : want);
      path.pop();
      left[color(j)]++;
      visited[j] = 0;
      if (solutions.length >= limit || exhausted) return;
    }
  };

  visited[start] = 1;
  left[color(start)]--;
  path.push(start);
  rec(2);
  return { solutions, exhausted };
}

/** Number of solutions up to `limit`. A search that runs out of budget reports `limit` (treated as not unique). */
export function countSolutions(p: WeavePuzzle, limit = 2): number {
  const { solutions, exhausted } = solveAll(p, { limit });
  return exhausted ? limit : solutions.length;
}

/* ---------------- Grader ---------------- */

/** Difficulty 0..100 from board size, how sparse the numbers are, and how few walls help. */
export function grade(p: WeavePuzzle): number {
  const N = p.size * p.size;
  const clues = p.clues.filter(Boolean).length;
  const sparsity = 1 - clues / N;
  const base = (p.size - 5) * 12;
  return Math.max(0, Math.min(100, Math.round(base + sparsity * 60 - p.walls.length * 1.2 - 20)));
}

/* ---------------- Generator ---------------- */

function cluesFor(n: number, path: number[], at: Set<number>): number[] {
  const clues = new Array<number>(n * n).fill(0);
  [...at].sort((a, b) => a - b).forEach((k, rank) => (clues[path[k]] = rank + 1));
  return clues;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<WeavePuzzle, WeaveSolution> {
  const n = SIZE_FOR[difficulty];
  const N = n * n;
  for (let attempt = 0; attempt < 200; attempt++) {
    const path = randomHamiltonianPath(n, n, rng);
    const at = new Set<number>([0, N - 1]);
    const want = Math.max(2, Math.round(N * CLUE_SHARE[difficulty]));
    // spread the opening numbers along the path with a little jitter
    for (let k = 1; at.size < want; k++) {
      const base = Math.round((k * (N - 1)) / (want - 1));
      at.add(Math.max(1, Math.min(N - 2, base + rng.int(-2, 2))));
      if (k > want * 3) break;
    }
    const walls: [number, number][] = [];
    const pathEdges = new Set<number>();
    for (let k = 1; k < N; k++) pathEdges.add(edgeKey(path[k - 1], path[k]));
    let ok = false;
    for (let fix = 0; fix < 60; fix++) {
      const puzzle: WeavePuzzle = { size: n, clues: cluesFor(n, path, at), walls: walls.slice() };
      const { solutions, exhausted } = solveAll(puzzle, { limit: 2, budget: 150_000 });
      if (!exhausted && solutions.length === 1) {
        ok = true;
        break;
      }
      const alt = solutions.find((s) => s.some((c, k) => c !== path[k]));
      if (!alt) {
        // budget ran out: add a number in the middle of the widest gap between numbers
        const ks = [...at].sort((a, b) => a - b);
        let best = 0, gap = 0;
        for (let k = 1; k < ks.length; k++) if (ks[k] - ks[k - 1] > gap) [gap, best] = [ks[k] - ks[k - 1], ks[k - 1] + Math.floor((ks[k] - ks[k - 1]) / 2)];
        at.add(best);
        continue;
      }
      const diff = alt.findIndex((c, k) => c !== path[k]);
      // Repair with a wall on an edge the alternative uses but the solution does not, near the divergence.
      const altEdges: { key: number; a: number; b: number; k: number }[] = [];
      for (let k = 1; k < N; k++) {
        const key = edgeKey(alt[k - 1], alt[k]);
        if (!pathEdges.has(key)) altEdges.push({ key, a: alt[k - 1], b: alt[k], k });
      }
      const useWall = rng.chance(WALL_RATE[difficulty]) || at.size >= MAX_CLUES[difficulty];
      if (!useWall) {
        // a number on the solution cell where the paths split usually kills the alternative
        const trial = new Set(at).add(diff);
        const t: WeavePuzzle = { size: n, clues: cluesFor(n, path, trial), walls };
        if (!checkPath(t, alt).complete) {
          at.add(diff);
          continue;
        }
      }
      altEdges.sort((x, y) => Math.abs(x.k - diff) - Math.abs(y.k - diff));
      const e = altEdges[Math.min(altEdges.length - 1, rng.int(0, 1))];
      walls.push(e.a < e.b ? [e.a, e.b] : [e.b, e.a]);
    }
    if (!ok || at.size > MAX_CLUES[difficulty] + 2) continue;
    walls.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const puzzle: WeavePuzzle = { size: n, clues: cluesFor(n, path, at), walls };
    return { puzzle, solution: path, grade: grade(puzzle) };
  }
  throw new Error(`weave: could not generate a unique ${n}x${n} puzzle`);
}

/* ---------------- Verification ---------------- */

function isPath(p: WeavePuzzle, state: unknown): state is WeaveState {
  const N = p.size * p.size;
  return Array.isArray(state) && state.length <= N && state.every((v) => Number.isInteger(v) && v >= 0 && v < N);
}

/** Length of the prefix that matches the solution, over the cell count. Never reveals cells. */
function progressOf(p: WeavePuzzle, sol: WeaveSolution, state: WeaveState): number {
  if (!isPath(p, state)) return 0;
  let k = 0;
  while (k < state.length && state[k] === sol[k]) k++;
  return k / (p.size * p.size);
}

export function verify(p: WeavePuzzle, sol: WeaveSolution, state: WeaveState): VerifyResult {
  if (!isPath(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const progress = progressOf(p, sol, state);
  const c = checkPath(p, state);
  if (!c.valid) return { ok: false, progress, reason: c.error ?? "invalid" };
  if (!c.complete) return { ok: false, progress, reason: "incomplete" };
  const match = state.every((v, k) => v === sol[k]);
  return match ? { ok: true, progress: 1 } : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

export function hint(p: WeavePuzzle, sol: WeaveSolution, state: WeaveState): Hint | null {
  if (!isPath(p, state)) return { target: sol[0], text: "Start on 1." };
  let k = 0;
  while (k < state.length && state[k] === sol[k]) k++;
  if (k < state.length) return { target: state[k], text: "The path goes wrong here. Drag back to undo." };
  if (k >= sol.length) return null;
  if (k === 0) return { target: sol[0], text: "Start on 1." };
  return { target: sol[k], text: "The path continues here." };
}

const logic: GameLogic<WeavePuzzle, WeaveSolution, WeaveState> = {
  id: "weave",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
