/**
 * Light Up (Akari). Place lamps on white cells so every white cell is lit. A lamp lights its row and column
 * until a black cell stops it; two lamps never see each other; a numbered black cell has exactly that many
 * lamps on its four sides.
 *
 * One deduction engine serves the solver, the generator and the hints. Basic rules: a number with as many
 * free sides as lamps still needed fills them; a number already satisfied darkens its other sides; a dark
 * cell that only one free cell can light gets its lamp there; a lit cell can never hold a lamp. Lookahead
 * (hard and up): if assuming a lamp, or no lamp, breaks a rule after the basic rules run, the opposite holds.
 *
 * Generation: black cells with point symmetry, a random full lamp layout, every black cell numbered, then
 * numbers are removed in random order while the engine (at the difficulty's level) still solves the puzzle
 * from scratch. A puzzle the engine solves by sound deductions has exactly one solution.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { LIGHTUP_COPY as T } from "@/lib/copy/lightup";

/** Grid cell values */
export const WHITE = -1;
/** A black cell with no number */
export const BLACK = 5;
/** Player marks on white cells */
export const EMPTY = 0,
  LAMP = 1,
  MARK = 2;

export interface LightUpPuzzle {
  size: number;
  /** row-major: -1 white, 0..4 numbered black, 5 plain black */
  grid: number[];
}
export interface LightUpSolution {
  /** lamp cell indexes, ascending */
  lamps: number[];
}
/** Per cell: 0 empty, 1 lamp, 2 marked dark (black cells are ignored). */
export type LightUpState = number[];

interface Spec {
  size: number;
  /** share of cells that are black */
  black: number;
  /** 1 basic rules only, 2 with lookahead */
  level: 1 | 2;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { size: 7, black: 0.22, level: 1 },
  medium: { size: 8, black: 0.2, level: 1 },
  hard: { size: 10, black: 0.22, level: 2 },
  expert: { size: 10, black: 0.2, level: 2 },
  mega: { size: 10, black: 0.18, level: 2 },
};

/* ---------------- Geometry ---------------- */

export interface Geo {
  n: number;
  grid: number[];
  white: number[];
  /** white cells each white cell sees (not itself) */
  see: number[][];
  /** white neighbours of each cell */
  adj: number[][];
  /** numbered black cells */
  numbered: number[];
}

const geoCache = new WeakMap<LightUpPuzzle, Geo>();

export function geometry(p: LightUpPuzzle): Geo {
  const hit = geoCache.get(p);
  if (hit) return hit;
  const n = p.size;
  const g = p.grid;
  const see: number[][] = g.map(() => []);
  const adj: number[][] = g.map(() => []);
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n),
      c = i % n;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = r + dr,
        nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && g[nr * n + nc] === WHITE) adj[i].push(nr * n + nc);
      if (g[i] !== WHITE) continue;
      for (let y = r + dr, x = c + dc; y >= 0 && y < n && x >= 0 && x < n && g[y * n + x] === WHITE; y += dr, x += dc)
        see[i].push(y * n + x);
    }
  }
  const geo: Geo = {
    n,
    grid: g,
    white: g.flatMap((v, i) => (v === WHITE ? [i] : [])),
    see,
    adj,
    numbered: g.flatMap((v, i) => (v >= 0 && v <= 4 ? [i] : [])),
  };
  geoCache.set(p, geo);
  return geo;
}

/* ---------------- Deduction engine ---------------- */

/** Knowledge per cell: 0 unknown, 1 lamp, 2 no lamp. */
type K = Int8Array;
const U = 0,
  L = 1,
  N = 2;

export type Why = { kind: "clash"; cell: number } | { kind: "unlit"; cell: number } | { kind: "number"; cell: number };

function litMap(geo: Geo, k: K): Uint8Array {
  const lit = new Uint8Array(k.length);
  for (const i of geo.white)
    if (k[i] === L) {
      lit[i] = 1;
      for (const j of geo.see[i]) lit[j] = 1;
    }
  return lit;
}

/** First broken rule in `k`, or null. */
function broken(geo: Geo, k: K, lit = litMap(geo, k)): Why | null {
  for (const i of geo.white) {
    if (k[i] === L && geo.see[i].some((j) => k[j] === L)) return { kind: "clash", cell: i };
    if (!lit[i] && !(k[i] === U) && !geo.see[i].some((j) => k[j] === U && !lit[j])) return { kind: "unlit", cell: i };
  }
  for (const b of geo.numbered) {
    let lamps = 0,
      free = 0;
    for (const j of geo.adj[b]) {
      if (k[j] === L) lamps++;
      else if (k[j] === U && !lit[j]) free++;
    }
    if (lamps > geo.grid[b] || lamps + free < geo.grid[b]) return { kind: "number", cell: b };
  }
  return null;
}

export type Deduction =
  | { rule: "fill"; source: number; cells: number[]; value: 1; need: number; had: number }
  | { rule: "only"; source: number; cells: [number]; value: 1 }
  | { rule: "full"; source: number; cells: number[]; value: 2 }
  | { rule: "tryLamp"; source: number; cells: [number]; value: 2; why: Why }
  | { rule: "tryDark"; source: number; cells: [number]; value: 1; why: Why };

/**
 * One basic deduction (number fill, single lighter, number full), in that order, or null. "A lit cell holds no
 * lamp" is applied silently by the callers: the board already shows those cells lit, so it is never a hint.
 */
function basic(geo: Geo, k: K, lit: Uint8Array): Deduction | null {
  for (const b of geo.numbered) {
    let lamps = 0;
    const free: number[] = [];
    for (const j of geo.adj[b]) {
      if (k[j] === L) lamps++;
      else if (k[j] === U && !lit[j]) free.push(j);
    }
    const need = geo.grid[b] - lamps;
    if (need > 0 && free.length === need) return { rule: "fill", source: b, cells: free, value: 1, need, had: lamps };
  }
  for (const i of geo.white) {
    if (lit[i]) continue;
    const cand: number[] = [];
    if (k[i] === U) cand.push(i);
    for (const j of geo.see[i]) if (k[j] === U && !lit[j]) cand.push(j);
    if (cand.length === 1) return { rule: "only", source: i, cells: [cand[0]], value: 1 };
  }
  for (const b of geo.numbered) {
    let lamps = 0;
    const free: number[] = [];
    for (const j of geo.adj[b]) {
      if (k[j] === L) lamps++;
      else if (k[j] === U && !lit[j]) free.push(j);
    }
    if (lamps === geo.grid[b] && free.length) return { rule: "full", source: b, cells: free, value: 2 };
  }
  return null;
}

/** Runs the basic rules to a fixpoint. Returns the broken rule if one appears. */
function propagate(geo: Geo, k: K): Why | null {
  for (;;) {
    const lit = litMap(geo, k);
    const bad = broken(geo, k, lit);
    if (bad) return bad;
    // Apply every lit cell at once (cheap), then one rule at a time.
    let changed = false;
    for (const i of geo.white)
      if (k[i] === U && lit[i]) {
        k[i] = N;
        changed = true;
      }
    if (changed) continue;
    const d = basic(geo, k, lit);
    if (!d) return null;
    for (const c of d.cells) k[c] = d.value;
  }
}

/** One lookahead deduction: a cell whose lamp (or whose darkness) breaks a rule after propagation. */
function lookahead(geo: Geo, k: K, lit: Uint8Array): Deduction | null {
  for (const i of geo.white) {
    if (k[i] !== U || lit[i]) continue;
    const a = k.slice();
    a[i] = L;
    const whyLamp = propagate(geo, a);
    if (whyLamp) return { rule: "tryLamp", source: i, cells: [i], value: 2, why: whyLamp };
    const b = k.slice();
    b[i] = N;
    const whyDark = propagate(geo, b);
    if (whyDark) return { rule: "tryDark", source: i, cells: [i], value: 1, why: whyDark };
  }
  return null;
}

/** The next deduction a player could make from `k`. Lit cells count as dark already (players see them lit). */
export function nextDeduction(geo: Geo, k: K, level: 1 | 2): Deduction | null {
  const lit = litMap(geo, k);
  for (const i of geo.white) if (k[i] === U && lit[i]) k[i] = N;
  return basic(geo, k, lit) ?? (level === 2 ? lookahead(geo, k, lit) : null);
}

/** Solves from scratch with the engine. Returns the lamps, or null when it gets stuck or finds a contradiction. */
export function engineSolve(p: LightUpPuzzle, level: 1 | 2): number[] | null {
  const geo = geometry(p);
  const k: K = new Int8Array(p.grid.length);
  for (let i = 0; i < k.length; i++) if (p.grid[i] !== WHITE) k[i] = N;
  for (;;) {
    if (propagate(geo, k)) return null;
    if (geo.white.every((i) => k[i] !== U)) break;
    if (level < 2) return null;
    const d = lookahead(geo, k, litMap(geo, k));
    if (!d) return null;
    k[d.cells[0]] = d.value;
  }
  return geo.white.filter((i) => k[i] === L);
}

/* ---------------- Solution counting (backtracking) ---------------- */

export function countSolutions(p: LightUpPuzzle, limit: number): number {
  const geo = geometry(p);
  const k: K = new Int8Array(p.grid.length);
  for (let i = 0; i < k.length; i++) if (p.grid[i] !== WHITE) k[i] = N;
  let found = 0;
  const go = (k: K) => {
    if (found >= limit) return;
    if (propagate(geo, k)) return;
    const lit = litMap(geo, k);
    // Branch on the dark cell with the fewest ways to light it.
    let best: number[] | null = null;
    for (const i of geo.white) {
      if (lit[i]) continue;
      const cand: number[] = [];
      if (k[i] === U) cand.push(i);
      for (const j of geo.see[i]) if (k[j] === U && !lit[j]) cand.push(j);
      if (!best || cand.length < best.length) best = cand;
    }
    if (!best) {
      found++;
      return;
    }
    for (let t = 0; t < best.length && found < limit; t++) {
      const next = k.slice();
      for (let s = 0; s < t; s++) next[best[s]] = N;
      next[best[t]] = L;
      go(next);
    }
  };
  go(k);
  return found;
}

/* ---------------- Generator ---------------- */

function blacks(rng: Rng, n: number, share: number): number[] {
  const grid = new Array<number>(n * n).fill(WHITE);
  const target = Math.round(n * n * share);
  let placed = 0;
  for (let tries = 0; placed < target && tries < 1000; tries++) {
    const i = rng.int(0, n * n - 1);
    const j = n * n - 1 - i;
    if (grid[i] !== WHITE) continue;
    grid[i] = BLACK;
    grid[j] = BLACK;
    placed += i === j ? 1 : 2;
  }
  return grid;
}

/** 0..100 from board size, how many numbers are left and whether lookahead is needed. */
export function grade(p: LightUpPuzzle): number {
  const geo = geometry(p);
  const blackCount = p.grid.filter((v) => v !== WHITE).length;
  const sparse = 1 - geo.numbered.length / Math.max(1, blackCount);
  const deep = engineSolve(p, 1) ? 0 : 25;
  return Math.max(0, Math.min(100, Math.round((p.size - 7) * 12 + sparse * 40 + deep)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<LightUpPuzzle, LightUpSolution> {
  const spec = SPEC[difficulty];
  const n = spec.size;
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = blacks(rng, n, spec.black);
    // A random full lamp layout: walk the white cells in random order, lamp every one still dark.
    const lit = new Set<number>();
    const lamps: number[] = [];
    const base: LightUpPuzzle = { size: n, grid };
    const geo0 = geometry(base);
    for (const i of rng.shuffle(geo0.white.slice())) {
      if (lit.has(i)) continue;
      lamps.push(i);
      lit.add(i);
      for (const j of geo0.see[i]) lit.add(j);
    }
    if (!geo0.white.length) continue;
    const lampSet = new Set(lamps);
    const full = grid.map((v, i) => (v === WHITE ? WHITE : geo0.adj[i].filter((j) => lampSet.has(j)).length));
    let puzzle: LightUpPuzzle = { size: n, grid: full };
    if (!engineSolve(puzzle, spec.level)) continue;
    // Remove numbers while the engine still solves it.
    for (const b of rng.shuffle(geometry(puzzle).numbered.slice())) {
      const g = puzzle.grid.slice();
      g[b] = BLACK;
      const trial = { size: n, grid: g };
      if (engineSolve(trial, spec.level)) puzzle = trial;
    }
    const sol = engineSolve(puzzle, spec.level)!;
    return { puzzle, solution: { lamps: sol }, grade: grade(puzzle) };
  }
  throw new Error(`lightup: could not generate a ${n}x${n} board`);
}

/* ---------------- Checking ---------------- */

export interface Analysis {
  /** lit white cells */
  lit: Set<number>;
  /** lamps that see another lamp, and numbers with too many lamps */
  bad: Set<number>;
  clear: boolean;
  lamps: number;
  /** white cells on the board */
  whites: number;
}

export function analyze(p: LightUpPuzzle, cells: LightUpState): Analysis {
  const geo = geometry(p);
  const lit = new Set<number>();
  const bad = new Set<number>();
  let lamps = 0;
  for (const i of geo.white)
    if (cells[i] === LAMP) {
      lamps++;
      lit.add(i);
      for (const j of geo.see[i]) {
        lit.add(j);
        if (cells[j] === LAMP) bad.add(i);
      }
    }
  let numbersOk = true;
  for (const b of geo.numbered) {
    const k = geo.adj[b].filter((j) => cells[j] === LAMP).length;
    if (k > p.grid[b]) bad.add(b);
    if (k !== p.grid[b]) numbersOk = false;
  }
  const clear = !bad.size && numbersOk && geo.white.every((i) => lit.has(i));
  return { lit, bad, clear, lamps, whites: geo.white.length };
}

function cellsOf(p: LightUpPuzzle, state: unknown): LightUpState | null {
  if (!Array.isArray(state) || state.length !== p.size * p.size) return null;
  if (!state.every((v) => v === EMPTY || v === LAMP || v === MARK)) return null;
  return state as LightUpState;
}

export function verify(p: LightUpPuzzle, _sol: LightUpSolution, state: LightUpState): VerifyResult {
  const cells = cellsOf(p, state);
  if (!cells) return { ok: false, progress: 0, reason: "malformed state" };
  const a = analyze(p, cells);
  if (a.clear) return { ok: true, progress: 1 };
  return { ok: false, progress: progress(p, _sol, state), reason: a.bad.size ? "rule broken" : "not all lit" };
}

/** Share of white cells lit, with no credit while a rule is broken. Never says which lamps are right. */
export function progress(p: LightUpPuzzle, _sol: LightUpSolution, state: LightUpState): number {
  const cells = cellsOf(p, state);
  if (!cells) return 0;
  const a = analyze(p, cells);
  if (a.clear) return 1;
  const geo = geometry(p);
  return a.bad.size ? 0 : Math.min(0.99, a.lit.size / Math.max(1, geo.white.length));
}

/* ---------------- Hints ---------------- */

export function explain(p: LightUpPuzzle, d: Deduction): string {
  const n = p.size;
  const at = (i: number) => T.at(Math.floor(i / n), i % n);
  const why = (w: Why) =>
    w.kind === "unlit" ? T.why.unlit(at(w.cell)) : w.kind === "number" ? T.why.number(p.grid[w.cell], at(w.cell)) : T.why.clash;
  switch (d.rule) {
    case "fill":
      return T.hints.fill(p.grid[d.source], at(d.source), d.need, d.had);
    case "only":
      return d.cells[0] === d.source ? T.hints.onlySelf(at(d.source)) : T.hints.only(at(d.source), at(d.cells[0]));
    case "full":
      return T.hints.full(p.grid[d.source], at(d.source));
    case "tryLamp":
      return T.hints.tryLamp(at(d.source), why(d.why));
    case "tryDark":
      return T.hints.tryDark(at(d.source), why(d.why));
  }
}

export function hint(p: LightUpPuzzle, sol: LightUpSolution, state: LightUpState): Hint | null {
  const cells = cellsOf(p, state);
  if (!cells) return null;
  const geo = geometry(p);
  const lamps = new Set(sol.lamps);
  // Slips first: a lamp that is not in the solution, or an X on a cell that needs a lamp.
  for (const i of geo.white) {
    if (cells[i] === LAMP && !lamps.has(i)) return { target: i, text: T.hints.wrongLamp };
    if (cells[i] === MARK && lamps.has(i)) return { target: i, text: T.hints.wrongMark };
  }
  if (analyze(p, cells).clear) return null;
  const k: K = new Int8Array(p.grid.length);
  for (let i = 0; i < k.length; i++) k[i] = p.grid[i] !== WHITE ? N : cells[i] === LAMP ? L : cells[i] === MARK ? N : U;
  const d = nextDeduction(geo, k, 2);
  if (d) {
    // Point at a cell the player has not settled yet (a lamp to place first).
    const target = d.cells.find((c) => cells[c] === EMPTY) ?? d.cells[0];
    return { target, text: explain(p, d) };
  }
  // The engine is stuck (never for generated boards); fall back to a lamp from the solution, said honestly.
  const lit = analyze(p, cells).lit;
  const dark = geo.white.find((i) => !lit.has(i));
  const lamp = sol.lamps.find((l) => cells[l] !== LAMP && (l === dark || (dark !== undefined && geo.see[dark].includes(l))));
  if (dark === undefined || lamp === undefined) return null;
  return { target: lamp, text: T.hints.reveal(T.at(Math.floor(dark / p.size), dark % p.size)) };
}

const logic: GameLogic<LightUpPuzzle, LightUpSolution, LightUpState> = {
  id: "lightup",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
