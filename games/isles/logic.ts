/**
 * Isles (hashi): join islands with 1 or 2 straight bridges so each island's bridge count matches its
 * number. Bridges never cross or pass through islands, and every island ends up connected.
 * Generator grows islands outwards along bridges, then a propagating solver proves uniqueness.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { DC, DR } from "@/games/_shared/grid";

export interface Island {
  r: number;
  c: number;
  n: number;
}
export interface IslesPuzzle {
  rows: number;
  cols: number;
  /** islands in reading order */
  islands: Island[];
  /** every pair of islands that can see each other along a row or column, [a, b] with a < b */
  edges: [number, number][];
}
/** bridges per edge, 0..2 */
export type IslesSolution = number[];
/** bridges per edge, 0..2 */
export type IslesState = number[];

export const SHAPE_FOR: Record<Difficulty, { size: number; islands: number }> = {
  easy: { size: 6, islands: 8 },
  medium: { size: 7, islands: 11 },
  hard: { size: 8, islands: 14 },
  expert: { size: 8, islands: 17 },
  mega: { size: 9, islands: 22 },
};

/** unique boards to draw before keeping the one with the most choices */
const CANDIDATES: Record<Difficulty, number> = { easy: 6, medium: 12, hard: 24, expert: 30, mega: 30 };

export type IslesBreak = "cross" | "over";
export const RULE_COPY: Record<IslesBreak, string> = {
  cross: "Bridges cannot cross.",
  over: "Too many bridges on this island.",
};

/* ---------------- Geometry ---------------- */

/** Candidate edges: nearest island east and south of each island. */
export function findEdges(rows: number, cols: number, islands: Island[]): [number, number][] {
  const at = new Map<number, number>();
  islands.forEach((x, i) => at.set(x.r * cols + x.c, i));
  const edges: [number, number][] = [];
  islands.forEach((x, i) => {
    for (const d of [1, 2]) {
      let r = x.r + DR[d],
        c = x.c + DC[d];
      while (r < rows && c < cols) {
        const j = at.get(r * cols + c);
        if (j !== undefined) {
          edges.push([Math.min(i, j), Math.max(i, j)]);
          break;
        }
        r += DR[d];
        c += DC[d];
      }
    }
  });
  return edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Cells strictly between the two islands of an edge. */
export function edgeCells(p: Pick<IslesPuzzle, "cols" | "islands">, [a, b]: [number, number]): number[] {
  const A = p.islands[a],
    B = p.islands[b];
  const out: number[] = [];
  if (A.r === B.r) for (let c = Math.min(A.c, B.c) + 1; c < Math.max(A.c, B.c); c++) out.push(A.r * p.cols + c);
  else for (let r = Math.min(A.r, B.r) + 1; r < Math.max(A.r, B.r); r++) out.push(r * p.cols + A.c);
  return out;
}

/** For each edge, the edges it would cross. */
export function crossings(p: IslesPuzzle): number[][] {
  const cells = p.edges.map((e) => new Set(edgeCells(p, e)));
  return p.edges.map((_, i) => p.edges.flatMap((__, j) => (j !== i && [...cells[i]].some((x) => cells[j].has(x)) ? [j] : [])));
}

export interface IslesAnalysis {
  /** bridges per island */
  count: number[];
  /** islands over their number */
  over: Set<number>;
  /** edges that cross another built edge */
  crossed: Set<number>;
  complete: boolean;
}

export function analyze(p: IslesPuzzle, state: IslesState, cross = crossings(p)): IslesAnalysis {
  const count = new Array<number>(p.islands.length).fill(0);
  p.edges.forEach(([a, b], k) => {
    count[a] += state[k] ?? 0;
    count[b] += state[k] ?? 0;
  });
  const over = new Set(count.flatMap((c, i) => (c > p.islands[i].n ? [i] : [])));
  const crossed = new Set<number>();
  state.forEach((v, k) => v > 0 && cross[k].forEach((j) => state[j] > 0 && crossed.add(k)));
  const exact = count.every((c, i) => c === p.islands[i].n);
  return { count, over, crossed, complete: exact && crossed.size === 0 && connected(p, state) };
}

function connected(p: IslesPuzzle, state: IslesState): boolean {
  const n = p.islands.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  p.edges.forEach(([a, b], k) => {
    if (state[k] > 0) {
      adj[a].push(b);
      adj[b].push(a);
    }
  });
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length)
    for (const j of adj[stack.pop()!])
      if (!seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
  return seen.size === n;
}

/* ---------------- Solver ---------------- */

const ONE = [1, 2, 4]; // domain bit for 0, 1, 2 bridges
const has = (dom: number, v: number) => (dom & ONE[v]) !== 0;
const lo = (dom: number) => (dom & 1 ? 0 : dom & 2 ? 1 : 2);
const hi = (dom: number) => (dom & 4 ? 2 : dom & 2 ? 1 : 0);
const single = (dom: number) => dom === 1 || dom === 2 || dom === 4;

/** Enumerates up to `limit` solutions with sum, crossing and connectivity propagation. */
export function solveAll(p: IslesPuzzle, limit: number, budget = 300_000): { solutions: number[][]; exhausted: boolean } {
  const E = p.edges.length,
    I = p.islands.length;
  const cross = crossings(p);
  const inc: number[][] = Array.from({ length: I }, () => []);
  p.edges.forEach(([a, b], k) => {
    inc[a].push(k);
    inc[b].push(k);
  });
  const solutions: number[][] = [];
  let nodes = 0;
  let exhausted = false;

  const propagate = (dom: number[]): boolean => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < I; i++) {
        const es = inc[i];
        let minSum = 0,
          maxSum = 0;
        for (const k of es) {
          minSum += lo(dom[k]);
          maxSum += hi(dom[k]);
        }
        const n = p.islands[i].n;
        if (n < minSum || n > maxSum) return false;
        for (const k of es) {
          const restMin = minSum - lo(dom[k]),
            restMax = maxSum - hi(dom[k]);
          let next = dom[k];
          for (let v = 0; v <= 2; v++) if (has(next, v) && (n - v < restMin || n - v > restMax)) next &= ~ONE[v];
          if (next !== dom[k]) {
            if (!next) return false;
            dom[k] = next;
            changed = true;
            minSum = restMin + lo(next);
            maxSum = restMax + hi(next);
          }
        }
      }
      for (let k = 0; k < E; k++) {
        if (has(dom[k], 0)) continue;
        for (const j of cross[k]) {
          if (!has(dom[j], 0)) return false;
          if (dom[j] !== 1) {
            dom[j] = 1;
            changed = true;
          }
        }
      }
    }
    return true;
  };

  /** islands must still be connectable, and a closed-off group must be everything */
  const graphOk = (dom: number[]): boolean => {
    const parent = Array.from({ length: I }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a: number, b: number) => (parent[find(a)] = find(b));
    for (let k = 0; k < E; k++) if (hi(dom[k]) > 0) union(p.edges[k][0], p.edges[k][1]);
    const root = find(0);
    for (let i = 1; i < I; i++) if (find(i) !== root) return false;
    // definite groups: joined by edges that must have a bridge; closed if no undecided edge leaves them
    for (let i = 0; i < I; i++) parent[i] = i;
    for (let k = 0; k < E; k++) if (lo(dom[k]) > 0) union(p.edges[k][0], p.edges[k][1]);
    const open = new Set<number>();
    const groups = new Set<number>();
    for (let i = 0; i < I; i++) groups.add(find(i));
    if (groups.size === 1) return true;
    for (let k = 0; k < E; k++) {
      const [a, b] = p.edges[k];
      if (find(a) !== find(b) && hi(dom[k]) > 0) {
        open.add(find(a));
        open.add(find(b));
      }
    }
    for (const g of groups) if (!open.has(g)) return false;
    return true;
  };

  const rec = (dom: number[]) => {
    if (solutions.length >= limit || exhausted) return;
    if (++nodes > budget) {
      exhausted = true;
      return;
    }
    if (!propagate(dom) || !graphOk(dom)) return;
    let best = -1;
    for (let k = 0; k < E; k++) if (!single(dom[k]) && (best < 0 || dom[k] === 3 || dom[k] === 6)) best = k;
    if (best < 0) {
      solutions.push(dom.map(lo));
      return;
    }
    for (let v = 2; v >= 0; v--) {
      if (!has(dom[best], v)) continue;
      const next = dom.slice();
      next[best] = ONE[v];
      rec(next);
      if (solutions.length >= limit || exhausted) return;
    }
  };
  rec(new Array<number>(E).fill(7));
  return { solutions, exhausted };
}

/** Solutions up to `limit`; running out of budget reports `limit` (treated as not unique). */
export function countSolutions(p: IslesPuzzle, limit = 2): number {
  const { solutions, exhausted } = solveAll(p, limit);
  return exhausted ? limit : solutions.length;
}

/* ---------------- Grader ---------------- */

/** Difficulty 0..100: island count, board size and how many bridges are doubles. */
export function grade(p: IslesPuzzle, sol?: IslesSolution): number {
  const doubles = sol ? sol.filter((v) => v === 2).length / Math.max(1, sol.filter(Boolean).length) : 0.3;
  const g = p.islands.length * 3 + (p.rows - 6) * 4 - 6 + (1 - doubles) * 12 + p.edges.length * 0.5;
  return Math.max(0, Math.min(100, Math.round(g)));
}

/* ---------------- Generator ---------------- */

function grow(size: number, target: number, rng: Rng): { islands: Island[]; bridges: Map<string, number> } | null {
  const N = size * size;
  const island = new Int32Array(N).fill(-1);
  /** 0 free, 1 horizontal bridge, 2 vertical bridge */
  const used = new Uint8Array(N);
  const islands: Island[] = [];
  const bridges = new Map<string, number>();
  const place = (r: number, c: number) => {
    island[r * size + c] = islands.length;
    islands.push({ r, c, n: 0 });
  };
  place(rng.int(0, size - 1), rng.int(0, size - 1));
  let fails = 0;
  /** islands visible from (r, c) along rows and columns: more sight lines, more choices */
  const sight = (r: number, c: number) => {
    let n = 0;
    for (let e = 0; e < 4; e++) {
      for (let rr = r + DR[e], cc = c + DC[e]; rr >= 0 && cc >= 0 && rr < size && cc < size; rr += DR[e], cc += DC[e]) {
        if (island[rr * size + cc] >= 0) {
          n++;
          break;
        }
      }
    }
    return n;
  };
  const valid = (A: Island, d: number, len: number) => {
    const r = A.r + DR[d] * len,
      c = A.c + DC[d] * len;
    if (r < 0 || c < 0 || r >= size || c >= size) return false;
    const i = r * size + c;
    if (island[i] >= 0 || used[i]) return false;
    for (let k = 1; k < len; k++) {
      const j = (A.r + DR[d] * k) * size + A.c + DC[d] * k;
      if (island[j] >= 0 || used[j]) return false;
    }
    // keep islands from touching orthogonally, so every island reads on its own
    for (let e = 0; e < 4; e++) {
      const rr = r + DR[e],
        cc = c + DC[e];
      if (rr >= 0 && cc >= 0 && rr < size && cc < size && island[rr * size + cc] >= 0) return false;
    }
    return true;
  };
  while (islands.length < target && fails < 400) {
    // sample a few legal growth moves and keep the one that lines up with the most islands
    let pick: { from: number; d: number; len: number; s: number } | null = null;
    for (let t = 0; t < 8; t++) {
      const from = rng.int(0, islands.length - 1);
      const d = rng.int(0, 3);
      const len = rng.int(2, Math.max(2, Math.floor(size / 2) + 1));
      if (!valid(islands[from], d, len)) continue;
      const s = sight(islands[from].r + DR[d] * len, islands[from].c + DC[d] * len) + rng.next();
      if (!pick || s > pick.s) pick = { from, d, len, s };
    }
    if (!pick) {
      fails++;
      continue;
    }
    const { from, d, len } = pick;
    const A = islands[from];
    for (let k = 1; k < len; k++) used[(A.r + DR[d] * k) * size + A.c + DC[d] * k] = d % 2 ? 1 : 2;
    place(A.r + DR[d] * len, A.c + DC[d] * len);
    bridges.set(`${from},${islands.length - 1}`, rng.chance(0.4) ? 2 : 1);
  }
  if (islands.length < target) return null;
  return { islands, bridges };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<IslesPuzzle, IslesSolution> {
  const { size, islands: target } = SHAPE_FOR[difficulty];
  let best: { score: number; g: Generated<IslesPuzzle, IslesSolution> } | null = null;
  let found = 0;
  for (let attempt = 0; attempt < 600; attempt++) {
    const g = grow(size, target, rng);
    if (!g) continue;
    // relabel islands in reading order
    const order = g.islands.map((x, i) => ({ ...x, i })).sort((a, b) => a.r - b.r || a.c - b.c);
    const relabel = new Map(order.map((x, k) => [x.i, k]));
    const islands = order.map(({ r, c }) => ({ r, c, n: 0 }));
    const edges = findEdges(size, size, islands);
    const sol = new Array<number>(edges.length).fill(0);
    let valid = true;
    for (const [key, b] of g.bridges) {
      const [x, y] = key.split(",").map(Number);
      const a = relabel.get(x)!,
        bb = relabel.get(y)!;
      const k = edges.findIndex(([e0, e1]) => e0 === Math.min(a, bb) && e1 === Math.max(a, bb));
      if (k < 0) valid = false;
      else sol[k] = b;
    }
    if (!valid) continue;
    edges.forEach(([a, b], k) => {
      islands[a].n += sol[k];
      islands[b].n += sol[k];
    });
    const puzzle: IslesPuzzle = { rows: size, cols: size, islands, edges };
    const { solutions, exhausted } = solveAll(puzzle, 2, 60_000);
    if (exhausted || solutions.length !== 1) continue;
    // prefer boards with more choices: spare sight lines and lines that would cross
    const score = edges.length - islands.length + crossings(puzzle).flat().length * 0.25 + rng.next() * 0.1;
    if (!best || score > best.score) best = { score, g: { puzzle, solution: sol, grade: grade(puzzle, sol) } };
    if (++found >= CANDIDATES[difficulty]) break;
  }
  if (best) return best.g;
  throw new Error(`isles: could not generate a unique ${size}x${size} puzzle`);
}

/* ---------------- Verification ---------------- */

function isState(p: IslesPuzzle, state: unknown): state is IslesState {
  return Array.isArray(state) && state.length === p.edges.length && state.every((v) => v === 0 || v === 1 || v === 2);
}

/** Built bridges that match the key, over bridges in the key. Wrong bridges do not count. */
function progressOf(p: IslesPuzzle, sol: IslesSolution, state: IslesState): number {
  if (!isState(p, state)) return 0;
  let total = 0,
    right = 0;
  sol.forEach((v, k) => {
    total += v;
    right += Math.min(v, state[k]) - Math.max(0, state[k] - v);
  });
  return Math.max(0, right) / total;
}

export function verify(p: IslesPuzzle, sol: IslesSolution, state: IslesState): VerifyResult {
  if (!isState(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const progress = progressOf(p, sol, state);
  const a = analyze(p, state);
  if (a.crossed.size) return { ok: false, progress, reason: "cross" };
  if (a.over.size) return { ok: false, progress, reason: "over" };
  if (!a.complete) return { ok: false, progress, reason: "incomplete" };
  return state.every((v, k) => v === sol[k])
    ? { ok: true, progress: 1 }
    : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

/** Points at one edge (target = edge index) and says how many bridges it carries. Wrong bridges first. */
export function hint(p: IslesPuzzle, sol: IslesSolution, state: IslesState): Hint | null {
  const s = isState(p, state) ? state : new Array<number>(p.edges.length).fill(0);
  let k = s.findIndex((v, i) => v > sol[i]);
  if (k < 0) {
    // the bridge touching the fewest missing bridges first reads like a deduction: start at tight islands
    const wrong = sol.map((v, i) => (v !== s[i] ? i : -1)).filter((i) => i >= 0);
    if (!wrong.length) return null;
    const need = (i: number) => p.islands[i].n;
    wrong.sort((x, y) => Math.min(need(p.edges[x][0]), need(p.edges[x][1])) - Math.min(need(p.edges[y][0]), need(p.edges[y][1])) || x - y);
    k = wrong[0];
  }
  const v = sol[k];
  return {
    target: k,
    text: v === 0 ? "No bridge between these islands." : v === 1 ? "One bridge joins these islands." : "Two bridges join these islands.",
  };
}

const logic: GameLogic<IslesPuzzle, IslesSolution, IslesState> = {
  id: "isles",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
