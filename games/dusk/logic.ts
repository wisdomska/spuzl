/**
 * Dusk: fill the grid with suns and moons. Every row and column holds equal counts, never three of a
 * kind in a line, = joins two cells that match and × joins two that differ. Generator, propagation
 * solver with uniqueness counting, human-style deductions for hints and a grader.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export const EMPTY = 0;
export const SUN = 1;
export const MOON = 2;
export type Mark = typeof EMPTY | typeof SUN | typeof MOON;

/** A constraint between two orthogonal neighbours; `b` is always right of or below `a`. */
export interface Link {
  a: number;
  b: number;
  /** true: "=" (same), false: "×" (different) */
  same: boolean;
}

export interface DuskPuzzle {
  size: number;
  /** 0 open, 1 sun, 2 moon; row-major */
  givens: number[];
  links: Link[];
}
/** 1 sun, 2 moon per cell */
export type DuskSolution = number[];
/** 0 empty, 1 sun, 2 moon */
export type DuskState = number[];

export const SIZE_FOR: Record<Difficulty, number> = { easy: 6, medium: 6, hard: 6, expert: 8, mega: 10 };

const opp = (v: number) => (v === SUN ? MOON : SUN);
const name = (v: number) => (v === SUN ? "sun" : "moon");
const plural = (v: number) => (v === SUN ? "suns" : "moons");

/** Every line (rows then columns) as index lists. */
export function lines(n: number): { cells: number[]; label: string }[] {
  const out: { cells: number[]; label: string }[] = [];
  for (let r = 0; r < n; r++) out.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), label: `row ${r + 1}` });
  for (let c = 0; c < n; c++) out.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), label: `column ${c + 1}` });
  return out;
}

export type RuleBreak = "triple" | "count" | "same" | "differ";
export const RULE_COPY: Record<RuleBreak, string> = {
  triple: "Three in a line. Break it up.",
  count: "Too many of one kind in that line. Keep it even.",
  same: "= means those two match.",
  differ: "× means those two are different.",
};

export interface Analysis {
  filled: number;
  bad: Set<number>;
  rule: RuleBreak | null;
  message: string;
  clear: boolean;
}

export function analyze(p: DuskPuzzle, cells: DuskState): Analysis {
  const n = p.size;
  const bad = new Set<number>();
  let rule: RuleBreak | null = null;
  const flag = (why: RuleBreak, idx: number[]) => {
    idx.forEach((i) => bad.add(i));
    rule ??= why;
  };
  for (const { cells: L } of lines(n)) {
    for (let k = 0; k + 2 < n; k++) {
      const v = cells[L[k]];
      if (v && v === cells[L[k + 1]] && v === cells[L[k + 2]]) flag("triple", [L[k], L[k + 1], L[k + 2]]);
    }
    for (const v of [SUN, MOON]) {
      const own = L.filter((i) => cells[i] === v);
      if (own.length > n / 2) flag("count", own);
    }
  }
  for (const l of p.links) {
    const x = cells[l.a], y = cells[l.b];
    if (!x || !y) continue;
    if (l.same && x !== y) flag("same", [l.a, l.b]);
    if (!l.same && x === y) flag("differ", [l.a, l.b]);
  }
  const filled = cells.filter((v) => v !== EMPTY).length;
  return { filled, bad, rule, message: rule ? RULE_COPY[rule] : "", clear: filled === n * n && bad.size === 0 };
}

/* ---------------- Deductions (shared by solver, hints and grader) ---------------- */

export interface Deduction {
  cell: number;
  value: typeof SUN | typeof MOON;
  why: string;
}

/**
 * One human-style deduction, in order of how readable it is:
 * 1. a link with one side known; 2. two of a kind next to each other or with a gap;
 * 3. a line already holding half of one kind. Returns null when none applies.
 */
export function nextDeduction(p: DuskPuzzle, cells: DuskState): Deduction | null {
  const n = p.size;
  for (const l of p.links) {
    const x = cells[l.a], y = cells[l.b];
    if (x && !y) return { cell: l.b, value: (l.same ? x : opp(x)) as Deduction["value"], why: l.same ? `= copies the ${name(x)} next door.` : `× flips the ${name(x)} next door.` };
    if (y && !x) return { cell: l.a, value: (l.same ? y : opp(y)) as Deduction["value"], why: l.same ? `= copies the ${name(y)} next door.` : `× flips the ${name(y)} next door.` };
  }
  const ls = lines(n);
  for (const { cells: L } of ls) {
    for (let k = 0; k + 2 < n; k++) {
      const t = [L[k], L[k + 1], L[k + 2]];
      const vals = t.map((i) => cells[i]);
      const empties = t.filter((i) => cells[i] === EMPTY);
      if (empties.length !== 1) continue;
      const known = vals.filter((v) => v !== EMPTY);
      if (known[0] === known[1]) {
        const v = opp(known[0]) as Deduction["value"];
        return { cell: empties[0], value: v, why: `Two ${plural(known[0])} already sit together here. This one must be a ${name(v)}.` };
      }
    }
  }
  for (const { cells: L, label } of ls) {
    const empties = L.filter((i) => cells[i] === EMPTY);
    if (!empties.length) continue;
    for (const v of [SUN, MOON]) {
      if (L.filter((i) => cells[i] === v).length === n / 2) {
        return { cell: empties[0], value: opp(v) as Deduction["value"], why: `${label[0].toUpperCase()}${label.slice(1)} already has all its ${plural(v)}.` };
      }
    }
  }
  return null;
}

/** Applies deductions until none is left. Returns false on a contradiction. */
export function propagate(p: DuskPuzzle, cells: DuskState): boolean {
  for (;;) {
    if (analyze(p, cells).bad.size) return false;
    const d = nextDeduction(p, cells);
    if (!d) return true;
    cells[d.cell] = d.value;
  }
}

/** Counts solutions up to `limit` with propagation plus branching on the first open cell. */
export function countSolutions(p: DuskPuzzle, limit = 2): number {
  let count = 0;
  const rec = (cells: DuskState) => {
    if (count >= limit) return;
    if (!propagate(p, cells)) return;
    const i = cells.indexOf(EMPTY);
    if (i < 0) {
      count++;
      return;
    }
    for (const v of [SUN, MOON]) {
      const next = cells.slice();
      next[i] = v;
      rec(next);
    }
  };
  rec(p.givens.slice());
  return count;
}

export function solve(p: DuskPuzzle): DuskSolution | null {
  const rec = (cells: DuskState): DuskSolution | null => {
    if (!propagate(p, cells)) return null;
    const i = cells.indexOf(EMPTY);
    if (i < 0) return cells;
    for (const v of [SUN, MOON]) {
      const next = cells.slice();
      next[i] = v;
      const s = rec(next);
      if (s) return s;
    }
    return null;
  };
  return rec(p.givens.slice());
}

/** True when deductions alone (no guessing) fill the board. */
export function logicSolvable(p: DuskPuzzle): boolean {
  const cells = p.givens.slice();
  return propagate(p, cells) && !cells.includes(EMPTY);
}

/** 0..100: board size, how much of the board deductions leave open, and how few clues there are. */
export function grade(p: DuskPuzzle): number {
  const n = p.size;
  const cells = p.givens.slice();
  propagate(p, cells);
  const open = cells.filter((v) => v === EMPTY).length / (n * n);
  const sparse = 1 - (p.givens.filter(Boolean).length + p.links.length) / (n * n);
  const sizeBase = (n - 6) * 10; // 6 → 0, 8 → 20, 10 → 40
  return Math.max(0, Math.min(100, Math.round(sizeBase + open * 40 + sparse * 25)));
}

/* ---------------- Generator ---------------- */

function randomSolution(n: number, rng: Rng): DuskSolution | null {
  const empty: DuskPuzzle = { size: n, givens: new Array(n * n).fill(EMPTY), links: [] };
  let budget = 4000;
  const rec = (cells: DuskState): DuskSolution | null => {
    if (--budget < 0) return null;
    if (!propagate(empty, cells)) return null;
    const i = cells.indexOf(EMPTY);
    if (i < 0) return cells;
    for (const v of rng.shuffle([SUN, MOON])) {
      const next = cells.slice();
      next[i] = v;
      const s = rec(next);
      if (s) return s;
    }
    return null;
  };
  return rec(empty.givens.slice());
}

/** Every orthogonal neighbour pair, as links matching the solution. */
function allLinks(n: number, sol: DuskSolution): Link[] {
  const out: Link[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (c + 1 < n) out.push({ a: i, b: i + 1, same: sol[i] === sol[i + 1] });
      if (r + 1 < n) out.push({ a: i, b: i + n, same: sol[i] === sol[i + n] });
    }
  }
  return out;
}

interface Plan {
  /** links seeded before trimming, as a share of n*n */
  links: number;
  /** keep at least this share of cells as givens */
  minGivens: number;
  /** puzzle must fall to deductions alone */
  logicOnly: boolean;
}
const PLAN: Record<Difficulty, Plan> = {
  easy: { links: 0.2, minGivens: 0.3, logicOnly: true },
  medium: { links: 0.18, minGivens: 0.18, logicOnly: true },
  hard: { links: 0.16, minGivens: 0, logicOnly: false },
  expert: { links: 0.14, minGivens: 0, logicOnly: false },
  mega: { links: 0.12, minGivens: 0, logicOnly: false },
};

export function generate(rng: Rng, difficulty: Difficulty): Generated<DuskPuzzle, DuskSolution> {
  const n = SIZE_FOR[difficulty];
  const plan = PLAN[difficulty];
  for (let attempt = 0; attempt < 60; attempt++) {
    const sol = randomSolution(n, rng);
    if (!sol) continue;
    const links = rng.shuffle(allLinks(n, sol)).slice(0, Math.round(n * n * plan.links));
    const p: DuskPuzzle = { size: n, givens: sol.slice(), links };
    const ok = (q: DuskPuzzle) => countSolutions(q, 2) === 1 && (!plan.logicOnly || logicSolvable(q));
    const minGivens = Math.round(n * n * plan.minGivens);
    let givens = n * n;
    for (const i of rng.shuffle(Array.from({ length: n * n }, (_, k) => k))) {
      if (givens <= minGivens) break;
      p.givens[i] = EMPTY;
      if (ok(p)) givens--;
      else p.givens[i] = sol[i];
    }
    // Drop links that add nothing, but keep a few: they are the signature of the game.
    const minLinks = Math.round(n * n * 0.1);
    for (const l of rng.shuffle(p.links.slice())) {
      if (p.links.length <= minLinks) break;
      const rest = p.links.filter((x) => x !== l);
      if (ok({ ...p, links: rest })) p.links = rest;
    }
    if (!ok(p)) continue;
    p.links.sort((x, y) => x.a - y.a || x.b - y.b);
    return { puzzle: p, solution: sol, grade: grade(p) };
  }
  throw new Error(`dusk: could not generate a ${n}x${n} puzzle`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: DuskPuzzle, state: unknown): state is DuskState {
  const n = p.size;
  return Array.isArray(state) && state.length === n * n && state.every((v) => v === EMPTY || v === SUN || v === MOON);
}

export function verify(p: DuskPuzzle, sol: DuskSolution, state: DuskState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  if (p.givens.some((g, i) => g !== EMPTY && state[i] !== g)) return { ok: false, progress: 0, reason: "givens changed" };
  const progress = progressOf(p, sol, state);
  const a = analyze(p, state);
  if (!a.clear) return { ok: false, progress, reason: a.rule ?? "incomplete" };
  return state.every((v, i) => v === sol[i]) ? { ok: true, progress: 1 } : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

/** Share of open cells filled correctly. */
export function progressOf(p: DuskPuzzle, sol: DuskSolution, state: DuskState): number {
  if (!wellFormed(p, state)) return 0;
  const open = p.givens.flatMap((g, i) => (g === EMPTY ? [i] : []));
  if (!open.length) return 1;
  return open.filter((i) => state[i] === sol[i]).length / open.length;
}

export function hint(p: DuskPuzzle, sol: DuskSolution, state: DuskState): Hint | null {
  if (!wellFormed(p, state)) return null;
  const wrong = state.findIndex((v, i) => v !== EMPTY && v !== sol[i]);
  if (wrong >= 0) return { target: wrong, text: `This ${name(state[wrong])} does not belong here.` };
  const d = nextDeduction(p, state);
  if (d) return { target: d.cell, text: d.why };
  const i = state.indexOf(EMPTY);
  if (i < 0) return null;
  return { target: i, text: `Try a ${name(sol[i])} here.` };
}

const logic: GameLogic<DuskPuzzle, DuskSolution, DuskState> = {
  id: "dusk",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
