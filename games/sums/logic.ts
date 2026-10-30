/**
 * Sums (Kakuro): fill 1 to 9 so every run adds to its clue, with no repeats in a run.
 * Generator: symmetric layout where every white cell sits in an across and a down run of 2+,
 * random fill, clues from the fill, then the propagation + backtracking solver keeps only unique grids.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export interface SumsPuzzle {
  rows: number;
  cols: number;
  /** 1 white (fillable), 0 block; row 0 and column 0 are always blocks */
  white: number[];
  /** clue for the run going down from the cell below this block, 0 if none */
  down: number[];
  /** clue for the run going right from the cell after this block, 0 if none */
  right: number[];
}
export type SumsSolution = number[];
/** digit per cell, 0 empty */
export type SumsState = number[];

export interface Run {
  sum: number;
  cells: number[];
  /** the block holding the clue */
  clue: number;
  dir: "across" | "down";
}

interface Spec {
  size: number;
  maxRun: number;
  blocks: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { size: 5, maxRun: 4, blocks: 0.12 },
  medium: { size: 6, maxRun: 4, blocks: 0.18 },
  hard: { size: 7, maxRun: 5, blocks: 0.2 },
  expert: { size: 8, maxRun: 5, blocks: 0.24 },
  mega: { size: 9, maxRun: 5, blocks: 0.2 },
};

const ALL = 0b1111111110; // bits 1..9
const bit = (d: number) => 1 << d;
const popcount = (m: number) => {
  let c = 0;
  for (let x = m; x; x &= x - 1) c++;
  return c;
};
const digitsOf = (m: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & bit(d));

/** COMBOS[len][sum] = every digit set (bitmask) of that size and sum. */
const COMBOS: number[][][] = (() => {
  const out: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
  for (let m = 0; m < 512; m++) {
    const mask = m << 1;
    const ds = digitsOf(mask);
    out[ds.length][ds.reduce((s, d) => s + d, 0)].push(mask);
  }
  return out;
})();
export const combos = (len: number, sum: number) => (len <= 9 && sum <= 45 ? COMBOS[len][sum] : []);

export function runsOf(p: SumsPuzzle): Run[] {
  const out: Run[] = [];
  const { rows, cols } = p;
  for (let i = 0; i < rows * cols; i++) {
    if (p.white[i]) continue;
    const r = Math.floor(i / cols), c = i % cols;
    if (p.right[i]) {
      const cells: number[] = [];
      for (let x = c + 1; x < cols && p.white[r * cols + x]; x++) cells.push(r * cols + x);
      out.push({ sum: p.right[i], cells, clue: i, dir: "across" });
    }
    if (p.down[i]) {
      const cells: number[] = [];
      for (let y = r + 1; y < rows && p.white[y * cols + c]; y++) cells.push(y * cols + c);
      out.push({ sum: p.down[i], cells, clue: i, dir: "down" });
    }
  }
  return out;
}

/* ---------------- Rule checks ---------------- */

export type SumsBreak = "repeat" | "over" | "short";
export const BREAK_COPY: Record<SumsBreak, string> = {
  repeat: "No repeats in a run.",
  over: "That run adds up past its clue.",
  short: "That run does not add up to its clue.",
};

export interface Analysis {
  bad: Set<number>;
  rule: SumsBreak | null;
  message: string;
  filled: number;
  clear: boolean;
}

export function analyze(p: SumsPuzzle, state: SumsState, runs = runsOf(p)): Analysis {
  const bad = new Set<number>();
  let rule: SumsBreak | null = null;
  for (const run of runs) {
    const vals = run.cells.map((i) => state[i]).filter(Boolean);
    const sum = vals.reduce((s, v) => s + v, 0);
    let why: SumsBreak | null = null;
    if (new Set(vals).size !== vals.length) why = "repeat";
    else if (sum > run.sum || (vals.length < run.cells.length && sum + (run.cells.length - vals.length) > run.sum)) why = "over";
    else if (vals.length === run.cells.length && sum !== run.sum) why = "short";
    if (why) {
      rule ??= why;
      for (const i of run.cells) if (state[i]) bad.add(i);
    }
  }
  const whites = p.white.reduce((s, v) => s + v, 0);
  const filled = p.white.reduce((s, v, i) => s + (v && state[i] ? 1 : 0), 0);
  return { bad, rule, message: rule ? BREAK_COPY[rule] : "", filled, clear: !rule && filled === whites };
}

/* ---------------- Solver ---------------- */

interface Ctx {
  p: SumsPuzzle;
  runs: Run[];
  /** runs per cell */
  of: number[][];
}
const ctxOf = (p: SumsPuzzle): Ctx => {
  const runs = runsOf(p);
  const of: number[][] = Array.from({ length: p.rows * p.cols }, () => []);
  runs.forEach((r, k) => r.cells.forEach((i) => of[i].push(k)));
  return { p, runs, of };
};

/** Narrows domains to a fixpoint. Returns false on a contradiction. */
function propagate(ctx: Ctx, dom: number[]): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of ctx.runs) {
      const fixed = run.cells.reduce((m, i) => (popcount(dom[i]) === 1 ? m | dom[i] : m), 0);
      const fixedCount = run.cells.filter((i) => popcount(dom[i]) === 1).length;
      if (popcount(fixed) !== fixedCount) return false; // repeat
      let union = 0;
      for (const c of combos(run.cells.length, run.sum)) {
        if ((c & fixed) !== fixed) continue;
        if (run.cells.some((i) => !(dom[i] & c))) continue;
        union |= c;
      }
      if (!union) return false;
      for (const i of run.cells) {
        let d = dom[i] & union;
        if (popcount(dom[i]) !== 1) d &= ~fixed;
        if (!d) return false;
        if (d !== dom[i]) {
          dom[i] = d;
          changed = true;
        }
      }
    }
  }
  return true;
}

function initialDomains(ctx: Ctx, given?: SumsState): number[] {
  return ctx.p.white.map((w, i) => (!w ? 0 : given && given[i] ? bit(given[i]) : ALL));
}

function search(ctx: Ctx, limit: number, start: number[], found?: (d: number[]) => void): number {
  let count = 0;
  const rec = (dom: number[]) => {
    if (count >= limit) return;
    if (!propagate(ctx, dom)) return;
    let pick = -1, best = 10;
    for (let i = 0; i < dom.length; i++) {
      const n = popcount(dom[i]);
      if (ctx.p.white[i] && n > 1 && n < best) {
        best = n;
        pick = i;
      }
    }
    if (pick < 0) {
      count++;
      found?.(dom);
      return;
    }
    for (const d of digitsOf(dom[pick])) {
      const next = dom.slice();
      next[pick] = bit(d);
      rec(next);
      if (count >= limit) return;
    }
  };
  rec(start.slice());
  return count;
}

export function countSolutions(p: SumsPuzzle, limit = 2): number {
  const ctx = ctxOf(p);
  return search(ctx, limit, initialDomains(ctx));
}

export function solve(p: SumsPuzzle, given?: SumsState): SumsSolution | null {
  const ctx = ctxOf(p);
  let out: number[] | null = null;
  search(ctx, 1, initialDomains(ctx, given), (d) => (out = d.map((m) => (m ? digitsOf(m)[0] : 0))));
  return out;
}

/** Domains after propagation alone, starting from the given entries. Null on contradiction. */
export function deduce(p: SumsPuzzle, given?: SumsState): number[] | null {
  const ctx = ctxOf(p);
  const dom = initialDomains(ctx, given);
  return propagate(ctx, dom) ? dom : null;
}

/** 0..100: share of cells propagation cannot settle, plus size. */
export function grade(p: SumsPuzzle): number {
  const dom = deduce(p)!;
  const whites = p.white.reduce((s, v) => s + v, 0);
  const settled = dom.filter((m, i) => p.white[i] && popcount(m) === 1).length;
  return Math.max(0, Math.min(100, Math.round((p.rows - 4) * 10 + (1 - settled / whites) * 55)));
}

/* ---------------- Generator ---------------- */

function layout(spec: Spec, rng: Rng): number[] | null {
  const n = spec.size;
  const white = new Array<number>(n * n).fill(0);
  for (let r = 1; r < n; r++) for (let c = 1; c < n; c++) white[r * n + c] = 1;
  // symmetric blocks (180° about the interior centre)
  const mirror = (i: number) => {
    const r = Math.floor(i / n), c = i % n;
    return (n - r) * n + (n - c);
  };
  const interior = white.flatMap((v, i) => (v ? [i] : []));
  rng.shuffle(interior);
  const want = Math.round(interior.length * spec.blocks);
  for (let k = 0, made = 0; k < interior.length && made < want; k++) {
    const i = interior[k];
    if (!white[i]) continue;
    white[i] = 0;
    white[mirror(i)] = 0;
    made += i === mirror(i) ? 1 : 2;
  }
  // repair: no run of 1, no run longer than maxRun
  for (let pass = 0; pass < 20; pass++) {
    let fixed = true;
    for (let i = 0; i < n * n; i++) {
      if (!white[i]) continue;
      const r = Math.floor(i / n), c = i % n;
      const h = runLen(white, n, r, c, 0, 1), v = runLen(white, n, r, c, 1, 0);
      if (h === 1 || v === 1) {
        white[i] = 0;
        white[mirror(i)] = 0;
        fixed = false;
      } else if (h > spec.maxRun || v > spec.maxRun) {
        // cut the long run near its middle
        const cells = h > spec.maxRun ? runCells(white, n, r, c, 0, 1) : runCells(white, n, r, c, 1, 0);
        const cut = cells[Math.floor(cells.length / 2) + rng.int(-1, 0)];
        white[cut] = 0;
        white[mirror(cut)] = 0;
        fixed = false;
      }
    }
    if (fixed) break;
  }
  const count = white.reduce((s, v) => s + v, 0);
  if (count < (n - 1) * (n - 1) * 0.5) return null;
  if (!connected(white, n)) return null;
  for (let i = 0; i < n * n; i++) {
    if (!white[i]) continue;
    const r = Math.floor(i / n), c = i % n;
    const h = runLen(white, n, r, c, 0, 1), v = runLen(white, n, r, c, 1, 0);
    if (h < 2 || v < 2 || h > spec.maxRun || v > spec.maxRun) return null;
  }
  return white;
}

function runCells(white: number[], n: number, r: number, c: number, dr: number, dc: number): number[] {
  let y = r, x = c;
  while (y - dr >= 0 && x - dc >= 0 && white[(y - dr) * n + x - dc]) {
    y -= dr;
    x -= dc;
  }
  const out: number[] = [];
  while (y < n && x < n && white[y * n + x]) {
    out.push(y * n + x);
    y += dr;
    x += dc;
  }
  return out;
}
const runLen = (white: number[], n: number, r: number, c: number, dr: number, dc: number) => runCells(white, n, r, c, dr, dc).length;

function connected(white: number[], n: number): boolean {
  const cells = white.flatMap((v, i) => (v ? [i] : []));
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n), c = i % n;
    for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const j = y * n + x;
      if (y >= 0 && x >= 0 && y < n && x < n && white[j] && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/** Random fill with no repeats in any run. */
function fill(p: SumsPuzzle, rng: Rng): number[] | null {
  const ctx = ctxOf(p);
  const cells = p.white.flatMap((v, i) => (v ? [i] : []));
  const val = new Array<number>(p.rows * p.cols).fill(0);
  let steps = 0;
  const rec = (k: number): boolean => {
    if (k === cells.length) return true;
    if (++steps > 20_000) return false;
    const i = cells[k];
    const used = new Set(ctx.of[i].flatMap((r) => ctx.runs[r].cells.map((j) => val[j])));
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (used.has(d)) continue;
      val[i] = d;
      if (rec(k + 1)) return true;
    }
    val[i] = 0;
    return false;
  };
  return rec(0) ? val : null;
}

/** Clues from a layout and fill. */
function cluesFor(n: number, white: number[], val: number[]): { down: number[]; right: number[] } {
  const down = new Array<number>(n * n).fill(0);
  const right = new Array<number>(n * n).fill(0);
  for (let i = 0; i < n * n; i++) {
    if (white[i]) continue;
    const r = Math.floor(i / n), c = i % n;
    if (c + 1 < n && white[i + 1]) right[i] = runCells(white, n, r, c + 1, 0, 1).reduce((s, j) => s + val[j], 0);
    if (r + 1 < n && white[i + n]) down[i] = runCells(white, n, r + 1, c, 1, 0).reduce((s, j) => s + val[j], 0);
  }
  return { down, right };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<SumsPuzzle, SumsSolution> {
  const spec = SPEC[difficulty];
  const n = spec.size;
  for (let attempt = 0; attempt < 400; attempt++) {
    const white = layout(spec, rng);
    if (!white) continue;
    const shell: SumsPuzzle = { rows: n, cols: n, white, down: [], right: [] };
    // mark every clue cell so runsOf can see runs before the sums are known
    const marks = cluesFor(n, white, new Array(n * n).fill(1));
    shell.down = marks.down;
    shell.right = marks.right;
    const ctx = ctxOf(shell);
    let val = fill(shell, rng);
    // repair loop: while a second answer exists, change one cell where the answers differ
    const budget = white.reduce((s, v) => s + v, 0) * 3;
    for (let t = 0; val && t < budget; t++) {
      const { down, right } = cluesFor(n, white, val);
      const puzzle: SumsPuzzle = { rows: n, cols: n, white, down, right };
      const pctx = ctxOf(puzzle);
      const sols: number[][] = [];
      search(pctx, 2, initialDomains(pctx), (d) => sols.push(d.map((m) => (m ? digitsOf(m)[0] : 0))));
      if (sols.length === 1) return { puzzle, solution: val, grade: grade(puzzle) };
      const alt = sols.find((x) => x.some((v, i) => v !== val![i]))!;
      const diff = alt.flatMap((v, i) => (v !== val![i] ? [i] : []));
      const i = rng.pick(diff);
      const used = new Set(ctx.of[i].flatMap((r) => ctx.runs[r].cells.filter((j) => j !== i).map((j) => val![j])));
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d) && d !== val![i] && d !== alt[i]);
      if (!options.length) break;
      val = val.slice();
      val[i] = rng.pick(options);
    }
  }
  throw new Error(`sums: could not generate a unique ${difficulty} grid`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: SumsPuzzle, state: unknown): state is SumsState {
  return Array.isArray(state) && state.length === p.rows * p.cols && state.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 9 && (p.white[i] || v === 0));
}

/** Correct digits over white cells, minus wrong ones. */
export function progress(p: SumsPuzzle, sol: SumsSolution, state: SumsState): number {
  if (!wellFormed(p, state)) return 0;
  const whites = p.white.reduce((s, v) => s + v, 0);
  let good = 0, bad = 0;
  p.white.forEach((w, i) => {
    if (!w || !state[i]) return;
    if (state[i] === sol[i]) good++;
    else bad++;
  });
  return Math.max(0, (good - bad) / whites);
}

export function verify(p: SumsPuzzle, sol: SumsSolution, state: SumsState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const a = analyze(p, state);
  const prog = progress(p, sol, state);
  if (!a.clear) return { ok: false, progress: prog, reason: a.rule ?? "incomplete" };
  const match = p.white.every((w, i) => !w || state[i] === sol[i]);
  return match ? { ok: true, progress: 1 } : { ok: false, progress: prog, reason: "valid but not the scheduled solution" };
}

export function hint(p: SumsPuzzle, sol: SumsSolution, state: SumsState): Hint | null {
  if (!wellFormed(p, state)) return null;
  const wrong = p.white.findIndex((w, i) => w && state[i] && state[i] !== sol[i]);
  if (wrong >= 0) return { target: wrong, text: "This digit does not belong here." };
  const dom = deduce(p, state)!;
  for (let i = 0; i < dom.length; i++) {
    if (p.white[i] && !state[i] && popcount(dom[i]) === 1) return { target: i, text: `Only ${digitsOf(dom[i])[0]} fits here.` };
  }
  const missing = p.white.findIndex((w, i) => w && !state[i]);
  return missing >= 0 ? { target: missing, text: `Try ${sol[missing]} here.` } : null;
}

const logic: GameLogic<SumsPuzzle, SumsSolution, SumsState> = {
  id: "sums",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
