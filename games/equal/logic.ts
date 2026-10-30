/**
 * Equal: a square of numbers with operators between them; every row and every column is an equation
 * whose result is printed at its end. Some numbers are blank; place the leftover numbers so every
 * equation is true. Normal precedence (× and ÷ before + and −), exact arithmetic. The generator keeps
 * removing givens only while the solver still finds exactly one answer.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export type Op = "+" | "-" | "*" | "/";
export const OP_GLYPH: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

export interface EqualPuzzle {
  n: number;
  /** given number per cell, or 0 for a blank, row-major n × n */
  given: number[];
  /** operators between the numbers of each row, n rows × (n − 1) */
  rowOps: Op[][];
  /** operators between the numbers of each column, n columns × (n − 1) */
  colOps: Op[][];
  rowRes: number[];
  colRes: number[];
  /** the numbers that go in the blanks, sorted */
  pool: number[];
}
export type EqualSolution = number[];
/** number per cell; blanks the player has not filled are 0 (givens may be 0 or the given) */
export type EqualState = number[];

interface Spec {
  n: number;
  blanks: number;
  ops: Op[];
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { n: 3, blanks: 4, ops: ["+", "-", "*"] },
  medium: { n: 3, blanks: 6, ops: ["+", "-", "*", "/"] },
  hard: { n: 3, blanks: 8, ops: ["+", "-", "*", "/"] },
  expert: { n: 4, blanks: 9, ops: ["+", "-", "*", "/"] },
  mega: { n: 4, blanks: 11, ops: ["+", "-", "*", "/"] },
};

/* ---------------- Exact evaluation ---------------- */

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
type Frac = [number, number];
const norm = ([p, q]: Frac): Frac => {
  if (q < 0) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1;
  return [p / g, q / g];
};

/** Value of nums[0] op[0] nums[1] ... with × ÷ first, as a reduced fraction; null on ÷ 0. */
export function evaluate(nums: number[], ops: Op[]): Frac | null {
  // fold × and ÷ into terms, keeping the sign of each term
  const terms: Frac[] = [];
  const signs: number[] = [1];
  let cur: Frac = [nums[0], 1];
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k], v = nums[k + 1];
    if (o === "*") cur = norm([cur[0] * v, cur[1]]);
    else if (o === "/") {
      if (v === 0) return null;
      cur = norm([cur[0], cur[1] * v]);
    } else {
      terms.push(cur);
      signs.push(o === "+" ? 1 : -1);
      cur = [v, 1];
    }
  }
  terms.push(cur);
  let acc: Frac = [0, 1];
  terms.forEach((t, k) => (acc = norm([acc[0] * t[1] + signs[k] * t[0] * acc[1], acc[1] * t[1]])));
  return acc;
}

const holds = (nums: number[], ops: Op[], res: number) => {
  const v = evaluate(nums, ops);
  return !!v && v[1] === 1 && v[0] === res;
};

export const rowOf = (p: EqualPuzzle, cells: number[], r: number) => cells.slice(r * p.n, r * p.n + p.n);
export const colOf = (p: EqualPuzzle, cells: number[], c: number) => Array.from({ length: p.n }, (_, r) => cells[r * p.n + c]);

/** Merge givens and the player's entries into one board. */
export const board = (p: EqualPuzzle, state: EqualState) => p.given.map((g, i) => g || state[i] || 0);

export interface Analysis {
  /** cells on a full, false line */
  bad: Set<number>;
  /** "Row 2" / "Column 3" of the first false line */
  message: string;
  filled: number;
  clear: boolean;
}

export function analyze(p: EqualPuzzle, state: EqualState): Analysis {
  const b = board(p, state);
  const bad = new Set<number>();
  let message = "";
  for (let r = 0; r < p.n; r++) {
    const row = rowOf(p, b, r);
    if (row.every(Boolean) && !holds(row, p.rowOps[r], p.rowRes[r])) {
      row.forEach((_, c) => bad.add(r * p.n + c));
      message ||= `Row ${r + 1} is not true.`;
    }
  }
  for (let c = 0; c < p.n; c++) {
    const col = colOf(p, b, c);
    if (col.every(Boolean) && !holds(col, p.colOps[c], p.colRes[c])) {
      col.forEach((_, r) => bad.add(r * p.n + c));
      message ||= `Column ${c + 1} is not true.`;
    }
  }
  const blanks = p.given.filter((g) => !g).length;
  const filled = p.given.filter((g, i) => !g && state[i]).length;
  return { bad, message, filled, clear: filled === blanks && bad.size === 0 };
}

/* ---------------- Solver ---------------- */

/** Counts ways to place the pool into the blanks (up to `limit`), checking each line once it is full. */
function search(p: EqualPuzzle, limit: number, fixed: EqualState = [], found?: (b: number[]) => void): number {
  const b = p.given.map((g, i) => g || fixed[i] || 0);
  const left = new Map<number, number>();
  for (const v of p.pool) left.set(v, (left.get(v) ?? 0) + 1);
  for (let i = 0; i < b.length; i++) {
    if (p.given[i] || !b[i]) continue;
    const k = left.get(b[i]) ?? 0;
    if (!k) return 0;
    left.set(b[i], k - 1);
  }
  const blanks = b.flatMap((v, i) => (v ? [] : [i]));
  const n = p.n;
  const lineOk = (i: number) => {
    const r = Math.floor(i / n), c = i % n;
    const row = rowOf(p, b, r), col = colOf(p, b, c);
    if (row.every(Boolean) && !holds(row, p.rowOps[r], p.rowRes[r])) return false;
    if (col.every(Boolean) && !holds(col, p.colOps[c], p.colRes[c])) return false;
    return true;
  };
  // already-full lines must hold
  for (let i = 0; i < b.length; i++) if (b[i] && !lineOk(i)) return 0;
  let count = 0;
  const rec = (k: number) => {
    if (count >= limit) return;
    if (k === blanks.length) {
      count++;
      found?.(b.slice());
      return;
    }
    const i = blanks[k];
    for (const [v, m] of left) {
      if (!m) continue;
      b[i] = v;
      left.set(v, m - 1);
      if (lineOk(i)) rec(k + 1);
      left.set(v, m);
      b[i] = 0;
      if (count >= limit) return;
    }
  };
  rec(0);
  return count;
}

export function countSolutions(p: EqualPuzzle, limit = 2): number {
  return search(p, limit);
}

export function solve(p: EqualPuzzle, fixed: EqualState = []): EqualSolution | null {
  let out: number[] | null = null;
  search(p, 1, fixed, (b) => (out = b));
  return out;
}

/* ---------------- Generator ---------------- */

function lineOps(rng: Rng, nums: number[], ops: Op[]): Op[] | null {
  for (let t = 0; t < 30; t++) {
    const pick = nums.slice(1).map(() => rng.pick(ops));
    // ÷ only where the running term divides exactly, so every line reads cleanly
    let term = nums[0];
    let clean = true;
    for (let k = 0; k < pick.length; k++) {
      const v = nums[k + 1];
      if (pick[k] === "/") {
        if (term % v !== 0 || v === 1) clean = false;
        term = term / v;
      } else if (pick[k] === "*") term *= v;
      else term = v;
    }
    const val = evaluate(nums, pick);
    if (clean && val && val[1] === 1 && val[0] >= 0 && val[0] <= 999) return pick;
  }
  return null;
}

/** 0..100 from blanks, board size and how many line checks the solver needed. */
export function grade(p: EqualPuzzle): number {
  const blanks = p.given.filter((g) => !g).length;
  const divs = [...p.rowOps, ...p.colOps].flat().filter((o) => o === "/").length;
  return Math.max(0, Math.min(100, Math.round(blanks * 6 + (p.n - 3) * 18 + divs * 3)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<EqualPuzzle, EqualSolution> {
  const { n, blanks, ops } = SPEC[difficulty];
  for (let attempt = 0; attempt < 300; attempt++) {
    const nums = rng.shuffle(Array.from({ length: n * n }, (_, i) => i + 1));
    const rowOps: Op[][] = [];
    const colOps: Op[][] = [];
    let ok = true;
    for (let r = 0; r < n && ok; r++) {
      const o = lineOps(rng, nums.slice(r * n, r * n + n), ops);
      if (!o) ok = false;
      else rowOps.push(o);
    }
    for (let c = 0; c < n && ok; c++) {
      const o = lineOps(rng, Array.from({ length: n }, (_, r) => nums[r * n + c]), ops);
      if (!o) ok = false;
      else colOps.push(o);
    }
    if (!ok) continue;
    const rowRes = rowOps.map((o, r) => evaluate(nums.slice(r * n, r * n + n), o)![0]);
    const colRes = colOps.map((o, c) => evaluate(Array.from({ length: n }, (_, r) => nums[r * n + c]), o)![0]);
    // remove givens one by one while the answer stays unique
    const given = nums.slice();
    const order = rng.shuffle(nums.map((_, i) => i));
    let removed = 0;
    for (const i of order) {
      if (removed >= blanks) break;
      const v = given[i];
      given[i] = 0;
      const pool = nums.filter((_, j) => !given[j]).sort((a, b) => a - b);
      if (countSolutions({ n, given, rowOps, colOps, rowRes, colRes, pool }, 2) === 1) removed++;
      else given[i] = v;
    }
    if (removed < blanks) continue;
    const pool = nums.filter((_, j) => !given[j]).sort((a, b) => a - b);
    const puzzle: EqualPuzzle = { n, given, rowOps, colOps, rowRes, colRes, pool };
    return { puzzle, solution: nums, grade: grade(puzzle) };
  }
  throw new Error(`equal: could not generate a unique ${difficulty} grid`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: EqualPuzzle, state: unknown): state is EqualState {
  if (!Array.isArray(state) || state.length !== p.n * p.n) return false;
  return state.every((v, i) => Number.isInteger(v) && v >= 0 && (!p.given[i] || v === 0 || v === p.given[i]));
}

/** Placed numbers that match the answer, minus misplaced ones, over the blanks. */
export function progress(p: EqualPuzzle, sol: EqualSolution, state: EqualState): number {
  if (!wellFormed(p, state)) return 0;
  const blanks = p.given.flatMap((g, i) => (g ? [] : [i]));
  let good = 0, bad = 0;
  for (const i of blanks) {
    if (!state[i]) continue;
    if (state[i] === sol[i]) good++;
    else bad++;
  }
  return Math.max(0, (good - bad) / blanks.length);
}

export function verify(p: EqualPuzzle, sol: EqualSolution, state: EqualState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const prog = progress(p, sol, state);
  const placed = p.given.flatMap((g, i) => (g ? [] : [state[i]])).sort((a, b) => a - b);
  if (placed.some((v) => !v)) return { ok: false, progress: prog, reason: "incomplete" };
  if (placed.join() !== p.pool.join()) return { ok: false, progress: prog, reason: "numbers do not match the tray" };
  const a = analyze(p, state);
  if (!a.clear) return { ok: false, progress: prog, reason: a.message };
  const match = board(p, state).every((v, i) => v === sol[i]);
  return match ? { ok: true, progress: 1 } : { ok: false, progress: prog, reason: "valid but not the scheduled solution" };
}

export function hint(p: EqualPuzzle, sol: EqualSolution, state: EqualState | undefined): Hint | null {
  // before the first move the shell has no state yet: hint from the empty board
  if (state === undefined) state = new Array(p.n * p.n).fill(0);
  if (!wellFormed(p, state)) return null;
  const blanks = p.given.flatMap((g, i) => (g ? [] : [i]));
  const wrong = blanks.find((i) => state[i] && state[i] !== sol[i]);
  if (wrong !== undefined) return { target: wrong, text: "This number belongs somewhere else." };
  // a blank whose value is forced: every completion of the current board agrees on it
  const open = blanks.filter((i) => !state[i]);
  if (!open.length) return null;
  for (const i of open) {
    const r = Math.floor(i / p.n), c = i % p.n;
    const row = rowOf(p, board(p, state), r), col = colOf(p, board(p, state), c);
    const rowGap = row.filter((v) => !v).length, colGap = col.filter((v) => !v).length;
    if (rowGap === 1 || colGap === 1) return { target: i, text: `The last gap in ${rowGap === 1 ? `row ${r + 1}` : `column ${c + 1}`} takes ${sol[i]}.` };
  }
  const i = open[0];
  return { target: i, text: `Try ${sol[i]} here.` };
}

const logic: GameLogic<EqualPuzzle, EqualSolution, EqualState> = {
  id: "equal",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
