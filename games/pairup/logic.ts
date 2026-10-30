/**
 * Pairup (number link): join each pair of matching dots with a line. Lines never cross or share a
 * cell, and together they fill the whole grid. Every pair has a colour and a number.
 * Generator: a random Hamiltonian path cut into segments gives a full cover; a path-growing solver with
 * connectivity and dead-end pruning keeps only covers that are the unique solution.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { adjacent, neighbours } from "@/games/_shared/grid";

export interface PairupPuzzle {
  size: number;
  /** pair number per cell (1..k), 0 for an empty cell. Each number appears exactly twice. */
  dots: number[];
}
/** one path per pair (index = number - 1), from the first dot in reading order to the second */
export type PairupSolution = number[][];
/** the player's line per pair (index = number - 1), starting at either dot; empty when not drawn */
export type PairupState = number[][];

export const SHAPE_FOR: Record<Difficulty, { size: number; pairs: number }> = {
  easy: { size: 5, pairs: 5 },
  medium: { size: 6, pairs: 6 },
  hard: { size: 7, pairs: 7 },
  expert: { size: 8, pairs: 8 },
  mega: { size: 8, pairs: 7 },
};

export const pairCount = (p: PairupPuzzle) => p.dots.reduce((m, v) => Math.max(m, v), 0);

/** The two dot cells of each pair, in reading order. */
export function endpoints(p: PairupPuzzle): [number, number][] {
  const out: number[][] = Array.from({ length: pairCount(p) }, () => []);
  p.dots.forEach((v, i) => v && out[v - 1].push(i));
  return out as [number, number][];
}

export interface PairupAnalysis {
  /** pair number per cell from the drawn lines (dots included) */
  owner: number[];
  /** pairs whose line runs dot to dot */
  connected: Set<number>;
  filled: number;
  complete: boolean;
  /** first problem found in the lines, if any */
  error: string | null;
}

/** Checks lines: each starts on its own dot, moves one cell at a time, never overlaps or crosses a dot. */
export function analyze(p: PairupPuzzle, state: PairupState): PairupAnalysis {
  const n = p.size, N = n * n;
  const ends = endpoints(p);
  const owner = p.dots.slice();
  const connected = new Set<number>();
  let error: string | null = null;
  state.forEach((line, k) => {
    if (!line?.length || k >= ends.length) return;
    const pair = k + 1;
    const [a, b] = ends[k];
    if (line[0] !== a && line[0] !== b) error ??= "line does not start on its dot";
    for (let s = 0; s < line.length; s++) {
      const c = line[s];
      if (s > 0 && !adjacent(n, line[s - 1], c)) error ??= "line jumps";
      if (owner[c] !== 0 && owner[c] !== pair) error ??= "lines overlap";
      if (p.dots[c] === pair && s > 0 && s < line.length - 1) error ??= "line runs through its dot";
      if ((owner[c] === pair && p.dots[c] !== pair) || (s > 0 && c === line[0])) error ??= "line crosses itself";
      owner[c] = pair;
    }
    const other = line[0] === a ? b : a;
    if (line.length > 1 && line[line.length - 1] === other) connected.add(pair);
  });
  const filled = owner.filter(Boolean).length;
  return { owner, connected, filled, error, complete: !error && connected.size === ends.length && filled === N };
}

/* ---------------- Solver ---------------- */

/**
 * Enumerates up to `limit` solutions by growing one line at a time from its first dot (fewest options
 * first), pruning when a pair's ends are cut apart, an empty pocket can no longer be filled, or an
 * empty cell becomes a dead end.
 */
export function solveAll(p: PairupPuzzle, limit: number, budget = 300_000): { solutions: number[][][]; exhausted: boolean } {
  const n = p.size, N = n * n;
  const ends = endpoints(p);
  const K = ends.length;
  const nb = Array.from({ length: N }, (_, i) => neighbours(n, n, i));
  const owner = p.dots.slice();
  const lines: number[][] = ends.map(([a]) => [a]);
  const done = new Array<boolean>(K).fill(false);
  const solutions: number[][][] = [];
  let nodes = 0;
  let exhausted = false;
  const comp = new Int32Array(N);

  const ok = (): boolean => {
    // components of empty cells
    comp.fill(-1);
    let id = 0;
    const stack: number[] = [];
    for (let i = 0; i < N; i++) {
      if (owner[i] !== 0 || comp[i] >= 0) continue;
      comp[i] = id;
      stack.push(i);
      while (stack.length) {
        const x = stack.pop()!;
        for (const y of nb[x]) {
          if (owner[y] === 0 && comp[y] < 0) {
            comp[y] = id;
            stack.push(y);
          }
        }
      }
      id++;
    }
    const served = new Uint8Array(id);
    for (let k = 0; k < K; k++) {
      if (done[k]) continue;
      const head = lines[k][lines[k].length - 1], goal = ends[k][1];
      if (adjacent(n, head, goal)) {
        // can finish now; still may serve neighbouring pockets it touches on both sides
        const hs = new Set(nb[head].filter((y) => owner[y] === 0).map((y) => comp[y]));
        for (const y of nb[goal]) if (owner[y] === 0 && hs.has(comp[y])) served[comp[y]] = 1;
        continue;
      }
      const hs = new Set(nb[head].filter((y) => owner[y] === 0).map((y) => comp[y]));
      let joined = false;
      for (const y of nb[goal]) {
        if (owner[y] === 0 && hs.has(comp[y])) {
          served[comp[y]] = 1;
          joined = true;
        }
      }
      if (!joined) return false;
    }
    for (let c = 0; c < id; c++) if (!served[c]) return false;
    // dead ends: an empty cell needs two ways in or out (empty cells, or an open line's head or goal)
    const open = new Set<number>();
    for (let k = 0; k < K; k++) {
      if (done[k]) continue;
      open.add(lines[k][lines[k].length - 1]);
      open.add(ends[k][1]);
    }
    for (let i = 0; i < N; i++) {
      if (owner[i] !== 0) continue;
      let deg = 0;
      for (const y of nb[i]) if (owner[y] === 0 || open.has(y)) deg++;
      if (deg < 2) return false;
    }
    return true;
  };

  const moves = (k: number): number[] => {
    const head = lines[k][lines[k].length - 1], goal = ends[k][1];
    return nb[head].filter((y) => owner[y] === 0 || y === goal);
  };

  const rec = () => {
    if (solutions.length >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    let pick = -1, best: number[] = [];
    for (let k = 0; k < K; k++) {
      if (done[k]) continue;
      const m = moves(k);
      if (!m.length) return;
      if (pick < 0 || m.length < best.length) [pick, best] = [k, m];
      if (best.length === 1) break;
    }
    if (pick < 0) {
      if (owner.every(Boolean)) solutions.push(lines.map((l) => l.slice()));
      return;
    }
    const goal = ends[pick][1];
    for (const y of best) {
      lines[pick].push(y);
      if (y === goal) done[pick] = true;
      else owner[y] = pick + 1;
      if (ok()) rec();
      if (y === goal) done[pick] = false;
      else owner[y] = 0;
      lines[pick].pop();
      if (solutions.length >= limit || exhausted) return;
    }
  };
  if (ok()) rec();
  return { solutions, exhausted };
}

/** Solutions up to `limit`; running out of budget reports `limit` (treated as not unique). */
export function countSolutions(p: PairupPuzzle, limit = 2): number {
  const { solutions, exhausted } = solveAll(p, limit);
  return exhausted ? limit : solutions.length;
}

/* ---------------- Grader ---------------- */

/** Difficulty 0..100: board size, and longer lines per pair are harder. */
export function grade(p: PairupPuzzle): number {
  const N = p.size * p.size;
  const avg = N / pairCount(p);
  return Math.max(0, Math.min(100, Math.round((p.size - 4) * 13 + avg * 3 - 6)));
}

/* ---------------- Generator ---------------- */

/** A line that touches itself almost always has a shorter twin, so covers avoid them. */
function selfTouching(n: number, seg: number[]): boolean {
  for (let a = 0; a < seg.length; a++) for (let b = a + 2; b < seg.length; b++) if (adjacent(n, seg[a], seg[b])) return true;
  return false;
}

/**
 * Random cover of the grid by lines that never touch themselves: grow random walks that only step
 * where they touch nothing of their own but the head, then merge lines whose ends meet until about
 * `target` remain. Returns null when the cover is unusable (a line shorter than 3 cells).
 */
function cover(n: number, target: number, rng: Rng): number[][] | null {
  const N = n * n;
  const owner = new Int32Array(N).fill(-1);
  let lines: number[][] = [];
  for (const start of rng.shuffle(Array.from({ length: N }, (_, i) => i))) {
    if (owner[start] >= 0) continue;
    const id = lines.length;
    const line = [start];
    owner[start] = id;
    const max = rng.int(3, Math.max(4, Math.round((N / target) * 1.6)));
    while (line.length < max) {
      const head = line[line.length - 1];
      const opts = neighbours(n, n, head).filter((y) => owner[y] < 0 && neighbours(n, n, y).every((z) => z === head || owner[z] !== id));
      if (!opts.length) break;
      const y = rng.pick(opts);
      owner[y] = id;
      line.push(y);
    }
    lines.push(line);
  }
  // merge lines whose ends touch, shortest first, while the result stays self-avoiding
  const ends = (l: number[]) => [l[0], l[l.length - 1]];
  for (let guard = 0; guard < N * 4; guard++) {
    const short = lines.filter((l) => l.length < 3).length;
    if (lines.length <= target && !short) break;
    const order = rng.shuffle(lines.map((_, i) => i)).sort((a, b) => lines[a].length - lines[b].length);
    let merged = false;
    search: for (const a of order) {
      for (let b = 0; b < lines.length; b++) {
        if (a === b) continue;
        for (const ea of ends(lines[a])) {
          for (const eb of ends(lines[b])) {
            if (!adjacent(n, ea, eb)) continue;
            const A = ea === lines[a][lines[a].length - 1] ? lines[a] : lines[a].slice().reverse();
            const B = eb === lines[b][0] ? lines[b] : lines[b].slice().reverse();
            const m = A.concat(B);
            if (selfTouching(n, m)) continue;
            lines = lines.filter((_, i) => i !== a && i !== b).concat([m]);
            merged = true;
            break search;
          }
        }
      }
    }
    if (!merged) break;
  }
  return lines.every((l) => l.length >= 3) ? lines : null;
}

/** Number pairs by their first dot in reading order and run each line from that dot. */
function build(n: number, segs: number[][]): { puzzle: PairupPuzzle; lines: number[][] } {
  const lines = segs.map((s) => (s[0] < s[s.length - 1] ? s : s.slice().reverse())).sort((a, b) => a[0] - b[0]);
  const dots = new Array<number>(n * n).fill(0);
  lines.forEach((l, k) => {
    dots[l[0]] = k + 1;
    dots[l[l.length - 1]] = k + 1;
  });
  return { puzzle: { size: n, dots }, lines };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<PairupPuzzle, PairupSolution> {
  const { size: n, pairs } = SHAPE_FOR[difficulty];
  for (let attempt = 0; attempt < 2000; attempt++) {
    const segs = cover(n, pairs, rng);
    if (!segs || segs.length < pairs - 1 || segs.length > pairs + 2) continue;
    const { puzzle, lines } = build(n, segs);
    const { solutions, exhausted } = solveAll(puzzle, 2, 80_000);
    if (!exhausted && solutions.length === 1) return { puzzle, solution: lines, grade: grade(puzzle) };
  }
  throw new Error(`pairup: could not generate a unique ${n}x${n} puzzle`);
}

/* ---------------- Verification ---------------- */

function isState(p: PairupPuzzle, state: unknown): state is PairupState {
  const N = p.size * p.size;
  return (
    Array.isArray(state) &&
    state.length === pairCount(p) &&
    state.every((l) => Array.isArray(l) && l.length <= N && l.every((v) => Number.isInteger(v) && v >= 0 && v < N))
  );
}

/** Cells covered by the correct pair, over all cells. Wrong cells do not count. */
function progressOf(p: PairupPuzzle, sol: PairupSolution, state: PairupState): number {
  if (!isState(p, state)) return 0;
  const N = p.size * p.size;
  const want = new Array<number>(N).fill(0);
  sol.forEach((l, k) => l.forEach((c) => (want[c] = k + 1)));
  const a = analyze(p, state);
  return a.owner.filter((v, i) => v && v === want[i] && !p.dots[i]).length / (N - 2 * sol.length);
}

export function verify(p: PairupPuzzle, sol: PairupSolution, state: PairupState): VerifyResult {
  if (!isState(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const progress = progressOf(p, sol, state);
  const a = analyze(p, state);
  if (a.error) return { ok: false, progress, reason: a.error };
  if (!a.complete) return { ok: false, progress, reason: "incomplete" };
  const same = sol.every((l, k) => {
    const s = state[k];
    const fwd = s[0] === l[0] ? s : s.slice().reverse();
    return fwd.length === l.length && fwd.every((c, i) => c === l[i]);
  });
  return same ? { ok: true, progress: 1 } : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

/**
 * One safe step: point at the first cell where a line leaves the solution, otherwise the next cell
 * of the most finished line. Target is a cell index.
 */
export function hint(p: PairupPuzzle, sol: PairupSolution, state: PairupState): Hint | null {
  const lines = isState(p, state) ? state : sol.map(() => []);
  let bestK = -1, bestLen = -1, bestNext = -1;
  for (let k = 0; k < sol.length; k++) {
    const s = lines[k];
    const l = s.length && s[0] === sol[k][sol[k].length - 1] ? sol[k].slice().reverse() : sol[k];
    let m = 0;
    while (m < s.length && s[m] === l[m]) m++;
    if (m < s.length) return { target: s[m], text: `Line ${k + 1} goes wrong here.` };
    if (m < l.length && m > bestLen) [bestK, bestLen, bestNext] = [k, m, m === 0 ? l[0] : l[m]];
  }
  if (bestK < 0) return null;
  return { target: bestNext, text: bestLen === 0 ? `Start line ${bestK + 1} from this dot.` : `Line ${bestK + 1} continues here.` };
}

const logic: GameLogic<PairupPuzzle, PairupSolution, PairupState> = {
  id: "pairup",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
