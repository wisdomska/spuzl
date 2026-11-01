/**
 * Shared sudoku engine for Sixer (6 × 6, 2 × 3 boxes) and Nine (9 × 9, 3 × 3 boxes).
 * Bitmask solver with uniqueness counting, a human-technique solver (singles, locked candidates,
 * naked pairs) that drives both the difficulty curve and safe hints, a generator and a verifier.
 * Killer Sums adds cages (`SudokuPuzzle.cages`): `analyze` then also checks cage repeats and sums.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { sudoku as copy } from "@/lib/copy/sudoku";

/** Killer cage: its cells (row-major indices, ascending) add up to `sum` with no digit repeated. */
export interface Cage {
  cells: number[];
  sum: number;
}

export interface SudokuPuzzle {
  size: number;
  /** box width (columns) and height (rows) */
  boxW: number;
  boxH: number;
  /** 0 open, 1..size given; row-major */
  givens: number[];
  /** Killer Sums only: cages covering every cell */
  cages?: Cage[];
}
export type SudokuSolution = number[];
export interface SudokuState {
  /** 0 empty, 1..size; row-major, givens included */
  values: number[];
  /** pencil marks per cell, bit d-1 set for digit d (client only, never checked) */
  notes: number[];
}

export const BOX: Record<number, [number, number]> = { 4: [2, 2], 6: [3, 2], 9: [3, 3] };

/* ---------------- Geometry ---------------- */

interface Geo {
  size: number;
  units: { cells: number[]; kind: "row" | "column" | "box"; index: number }[];
  /** units each cell belongs to: [row, column, box] */
  unitsOf: number[][];
  peers: number[][];
  all: number;
}
const GEO = new Map<string, Geo>();

export function geometry(size: number, boxW: number, boxH: number): Geo {
  const key = `${size}:${boxW}:${boxH}`;
  const hit = GEO.get(key);
  if (hit) return hit;
  const units: Geo["units"] = [];
  for (let r = 0; r < size; r++) units.push({ cells: Array.from({ length: size }, (_, c) => r * size + c), kind: "row", index: r });
  for (let c = 0; c < size; c++) units.push({ cells: Array.from({ length: size }, (_, r) => r * size + c), kind: "column", index: c });
  const perRow = size / boxW;
  for (let b = 0; b < size; b++) {
    const r0 = Math.floor(b / perRow) * boxH,
      c0 = (b % perRow) * boxW;
    const cells: number[] = [];
    for (let r = 0; r < boxH; r++) for (let c = 0; c < boxW; c++) cells.push((r0 + r) * size + c0 + c);
    units.push({ cells, kind: "box", index: b });
  }
  const unitsOf: number[][] = Array.from({ length: size * size }, () => []);
  units.forEach((u, k) => u.cells.forEach((i) => unitsOf[i].push(k)));
  const peers = unitsOf.map((us, i) => [...new Set(us.flatMap((k) => units[k].cells))].filter((j) => j !== i));
  const g = { size, units, unitsOf, peers, all: (1 << size) - 1 };
  GEO.set(key, g);
  return g;
}

const geo = (p: SudokuPuzzle) => geometry(p.size, p.boxW, p.boxH);
const bits = (m: number) => {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
};
const digitOf = (m: number) => 31 - Math.clz32(m) + 1;
export const boxOf = (p: SudokuPuzzle, i: number) => {
  const r = Math.floor(i / p.size),
    c = i % p.size;
  return Math.floor(r / p.boxH) * (p.size / p.boxW) + Math.floor(c / p.boxW);
};

/* ---------------- Rules ---------------- */

export type RuleBreak = "row" | "column" | "box" | "cage" | "sum";
/** `d` is the repeated digit, or the cage total for "sum". */
export const ruleCopy = (rule: RuleBreak, d: number, boxW: number, boxH: number) =>
  rule === "sum"
    ? copy.cageSum(d)
    : rule === "cage"
      ? copy.cageRepeat(d)
      : rule === "box"
        ? `Two ${d}s in one ${boxW} × ${boxH} box.`
        : `Two ${d}s in one ${rule}.`;

export interface Analysis {
  filled: number;
  bad: Set<number>;
  rule: RuleBreak | null;
  message: string;
  clear: boolean;
}

export function analyze(p: SudokuPuzzle, values: number[]): Analysis {
  const g = geo(p);
  const bad = new Set<number>();
  let rule: RuleBreak | null = null;
  let digit = 0;
  for (const u of g.units) {
    const seen = new Map<number, number[]>();
    for (const i of u.cells) if (values[i]) seen.set(values[i], [...(seen.get(values[i]) ?? []), i]);
    for (const [d, cells] of seen) {
      if (cells.length < 2) continue;
      cells.forEach((i) => bad.add(i));
      if (!rule) {
        rule = u.kind;
        digit = d;
      }
    }
  }
  for (const cage of p.cages ?? []) {
    const seen = new Map<number, number[]>();
    let total = 0,
      placed = 0;
    for (const i of cage.cells) {
      if (!values[i]) continue;
      seen.set(values[i], [...(seen.get(values[i]) ?? []), i]);
      total += values[i];
      placed++;
    }
    for (const [d, cells] of seen) {
      if (cells.length < 2) continue;
      cells.forEach((i) => bad.add(i));
      if (!rule) {
        rule = "cage";
        digit = d;
      }
    }
    // Over the total already, or full and adding to something else.
    if (total > cage.sum || (placed === cage.cells.length && total !== cage.sum)) {
      for (const i of cage.cells) if (values[i]) bad.add(i);
      if (!rule) {
        rule = "sum";
        digit = cage.sum;
      }
    }
  }
  const filled = values.filter(Boolean).length;
  return {
    filled,
    bad,
    rule,
    message: rule ? ruleCopy(rule, digit, p.boxW, p.boxH) : "",
    clear: filled === p.size * p.size && bad.size === 0,
  };
}

/** Candidate masks from placed digits only. */
export function candidates(p: SudokuPuzzle, values: number[]): number[] {
  const g = geo(p);
  return values.map((v, i) => {
    if (v) return 0;
    let m = g.all;
    for (const j of g.peers[i]) if (values[j]) m &= ~(1 << (values[j] - 1));
    return m;
  });
}

/* ---------------- Brute-force solver ---------------- */

export function countSolutions(p: SudokuPuzzle, limit = 2): number {
  return search(p, p.givens.slice(), limit, null);
}

export function solve(p: SudokuPuzzle): SudokuSolution | null {
  const out: number[][] = [];
  search(p, p.givens.slice(), 1, out);
  return out[0] ?? null;
}

function search(p: SudokuPuzzle, values: number[], limit: number, out: number[][] | null, rng?: Rng): number {
  const g = geo(p);
  const n = p.size * p.size;
  if (analyze(p, values).bad.size) return 0;
  let count = 0;
  const rec = () => {
    if (count >= limit) return;
    let best = -1,
      bestMask = 0,
      bestBits = 99;
    for (let i = 0; i < n; i++) {
      if (values[i]) continue;
      let m = g.all;
      for (const j of g.peers[i]) if (values[j]) m &= ~(1 << (values[j] - 1));
      const b = bits(m);
      if (b === 0) return;
      if (b < bestBits) {
        best = i;
        bestMask = m;
        bestBits = b;
        if (b === 1) break;
      }
    }
    if (best < 0) {
      count++;
      out?.push(values.slice());
      return;
    }
    const ds: number[] = [];
    for (let d = 1; d <= p.size; d++) if (bestMask & (1 << (d - 1))) ds.push(d);
    for (const d of rng ? rng.shuffle(ds) : ds) {
      values[best] = d;
      rec();
      values[best] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}

/** A random complete grid (every row, column and box holds 1..size once). */
export function fullGrid(rng: Rng, size: number): number[] {
  const [boxW, boxH] = BOX[size];
  const out: number[][] = [];
  search({ size, boxW, boxH, givens: new Array(size * size).fill(0) }, new Array(size * size).fill(0), 1, out, rng);
  return out[0];
}

/* ---------------- Human techniques ---------------- */

export const TECHNIQUE = { nakedSingle: 1, hiddenSingle: 1, locked: 2, nakedPair: 3, guess: 4 } as const;

export interface Deduction {
  cell: number;
  value: number;
  why: string;
  level: number;
}

const unitName = (u: Geo["units"][number], p: SudokuPuzzle) =>
  u.kind === "box" ? `this ${p.boxW} × ${p.boxH} box` : `${u.kind} ${u.index + 1}`;

/** Eliminations from locked candidates and naked pairs. Returns true when any mask changed. */
function eliminate(p: SudokuPuzzle, masks: number[], maxLevel: number, used: { level: number }): boolean {
  const g = geo(p);
  let changed = false;
  if (maxLevel >= TECHNIQUE.locked) {
    for (const u of g.units) {
      for (let d = 1; d <= p.size; d++) {
        const bit = 1 << (d - 1);
        const where = u.cells.filter((i) => masks[i] & bit);
        if (where.length < 2) continue;
        // all spots for d in this unit share another unit: d leaves that other unit elsewhere
        const shared = g.unitsOf[where[0]].filter((k) => g.units[k] !== u && where.every((i) => g.unitsOf[i].includes(k)));
        for (const k of shared) {
          for (const j of g.units[k].cells) {
            if (!where.includes(j) && masks[j] & bit) {
              masks[j] &= ~bit;
              changed = true;
              used.level = Math.max(used.level, TECHNIQUE.locked);
            }
          }
        }
      }
    }
  }
  if (maxLevel >= TECHNIQUE.nakedPair) {
    for (const u of g.units) {
      const pairs = u.cells.filter((i) => bits(masks[i]) === 2);
      for (let x = 0; x < pairs.length; x++) {
        for (let y = x + 1; y < pairs.length; y++) {
          const m = masks[pairs[x]];
          if (m !== masks[pairs[y]]) continue;
          for (const j of u.cells) {
            if (j !== pairs[x] && j !== pairs[y] && masks[j] & m) {
              masks[j] &= ~m;
              changed = true;
              used.level = Math.max(used.level, TECHNIQUE.nakedPair);
            }
          }
        }
      }
    }
  }
  return changed;
}

function singles(p: SudokuPuzzle, values: number[], masks: number[]): Deduction | null {
  const g = geo(p);
  for (let i = 0; i < masks.length; i++) {
    if (!values[i] && bits(masks[i]) === 1) {
      const d = digitOf(masks[i]);
      return { cell: i, value: d, why: `Only ${d} fits here.`, level: TECHNIQUE.nakedSingle };
    }
  }
  for (const u of g.units) {
    for (let d = 1; d <= p.size; d++) {
      const bit = 1 << (d - 1);
      if (u.cells.some((i) => values[i] === d)) continue;
      const spots = u.cells.filter((i) => !values[i] && masks[i] & bit);
      if (spots.length === 1)
        return { cell: spots[0], value: d, why: `This is the only spot for ${d} in ${unitName(u, p)}.`, level: TECHNIQUE.hiddenSingle };
    }
  }
  return null;
}

/** One placement a person can find, using techniques up to `maxLevel`. */
export function nextDeduction(p: SudokuPuzzle, values: number[], maxLevel: number = TECHNIQUE.nakedPair): Deduction | null {
  const masks = candidates(p, values);
  const used = { level: 1 };
  for (;;) {
    const s = singles(p, values, masks);
    if (s) return { ...s, level: Math.max(s.level, used.level) };
    if (!eliminate(p, masks, maxLevel, used)) return null;
  }
}

/** Solves with techniques only. Returns the hardest level used, or TECHNIQUE.guess when stuck. */
export function logicLevel(p: SudokuPuzzle, maxLevel: number = TECHNIQUE.nakedPair): { level: number; steps: number } {
  const values = p.givens.slice();
  let level = 0,
    steps = 0;
  for (;;) {
    const d = nextDeduction(p, values, maxLevel);
    if (!d) break;
    values[d.cell] = d.value;
    level = Math.max(level, d.level);
    steps++;
  }
  return { level: values.includes(0) ? TECHNIQUE.guess : level, steps };
}

/** 0..100 from board size, hardest technique needed and clue count. */
export function grade(p: SudokuPuzzle): number {
  const { level } = logicLevel(p);
  const n = p.size * p.size;
  const clues = p.givens.filter(Boolean).length / n;
  const base = p.size === 9 ? 30 : 0;
  return Math.max(0, Math.min(100, Math.round(base + (level - 1) * 14 + (1 - clues) * 40)));
}

/* ---------------- Generator ---------------- */

interface Plan {
  maxLevel: number;
  /** stop removing at this many clues */
  floor: number;
  /** retry until the puzzle needs at least this level */
  minLevel: number;
}
const PLANS: Record<number, Record<Difficulty, Plan>> = {
  6: {
    easy: { maxLevel: 1, floor: 16, minLevel: 0 },
    medium: { maxLevel: 1, floor: 12, minLevel: 0 },
    hard: { maxLevel: 3, floor: 9, minLevel: 0 },
    expert: { maxLevel: 4, floor: 0, minLevel: 0 },
    mega: { maxLevel: 4, floor: 0, minLevel: 0 },
  },
  9: {
    easy: { maxLevel: 1, floor: 36, minLevel: 0 },
    medium: { maxLevel: 1, floor: 28, minLevel: 0 },
    hard: { maxLevel: 3, floor: 24, minLevel: 2 },
    expert: { maxLevel: 4, floor: 0, minLevel: 3 },
    mega: { maxLevel: 4, floor: 0, minLevel: 3 },
  },
};

export function generateSudoku(rng: Rng, difficulty: Difficulty, size: number): Generated<SudokuPuzzle, SudokuSolution> {
  const [boxW, boxH] = BOX[size];
  const plan = PLANS[size][difficulty];
  const n = size * size;
  let fallback: Generated<SudokuPuzzle, SudokuSolution> | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const empty: SudokuPuzzle = { size, boxW, boxH, givens: new Array(n).fill(0) };
    const full: number[][] = [];
    search(empty, empty.givens.slice(), 1, full, rng);
    const sol = full[0];
    const p: SudokuPuzzle = { ...empty, givens: sol.slice() };
    let clues = n;
    const tryRemove = (cells: number[]) => {
      if (clues - cells.length < plan.floor || cells.some((i) => !p.givens[i])) return;
      cells.forEach((i) => (p.givens[i] = 0));
      const ok = countSolutions(p, 2) === 1 && (plan.maxLevel >= TECHNIQUE.guess || logicLevel(p, plan.maxLevel).level <= plan.maxLevel);
      if (ok) clues -= cells.length;
      else cells.forEach((i) => (p.givens[i] = sol[i]));
    };
    // Remove cells in 180° symmetric pairs while the puzzle stays unique and within the technique budget.
    for (const i of rng.shuffle(Array.from({ length: Math.ceil(n / 2) }, (_, k) => k))) tryRemove(i === n - 1 - i ? [i] : [i, n - 1 - i]);
    // Harder plans then thin single cells, trading symmetry for a sparser grid.
    if (plan.maxLevel >= TECHNIQUE.nakedPair) for (const i of rng.shuffle(Array.from({ length: n }, (_, k) => k))) tryRemove([i]);
    const g = { puzzle: p, solution: sol, grade: grade(p) };
    fallback ??= g;
    if (logicLevel(p).level >= plan.minLevel) return g;
  }
  return fallback!;
}

/* ---------------- Verification ---------------- */

function valuesOf(p: SudokuPuzzle, state: unknown): number[] | null {
  const v = (state as SudokuState | null)?.values;
  const n = p.size * p.size;
  if (!Array.isArray(v) || v.length !== n || !v.every((x) => Number.isInteger(x) && x >= 0 && x <= p.size)) return null;
  return v;
}

export function verify(p: SudokuPuzzle, sol: SudokuSolution, state: SudokuState): VerifyResult {
  const v = valuesOf(p, state);
  if (!v) return { ok: false, progress: 0, reason: "malformed state" };
  if (p.givens.some((d, i) => d && v[i] !== d)) return { ok: false, progress: 0, reason: "givens changed" };
  const progress = progressOf(p, sol, state);
  const a = analyze(p, v);
  if (!a.clear) return { ok: false, progress, reason: a.rule ?? "incomplete" };
  return v.every((d, i) => d === sol[i])
    ? { ok: true, progress: 1 }
    : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

export function progressOf(p: SudokuPuzzle, sol: SudokuSolution, state: SudokuState): number {
  const v = valuesOf(p, state);
  if (!v) return 0;
  const open = p.givens.flatMap((d, i) => (d ? [] : [i]));
  if (!open.length) return 1;
  return open.filter((i) => v[i] === sol[i]).length / open.length;
}

export function hint(p: SudokuPuzzle, sol: SudokuSolution, state: SudokuState): Hint | null {
  const v = valuesOf(p, state);
  if (!v) return null;
  const wrong = v.findIndex((d, i) => d && d !== sol[i]);
  if (wrong >= 0) return { target: wrong, text: `This ${v[wrong]} does not belong here.` };
  const d = nextDeduction(p, v);
  if (d) return { target: d.cell, text: d.why };
  // Reveal the open cell with the fewest candidates.
  const masks = candidates(p, v);
  let best = -1;
  masks.forEach((m, i) => {
    if (!v[i] && (best < 0 || bits(m) < bits(masks[best]))) best = i;
  });
  return best < 0 ? null : { target: best, text: `Try ${sol[best]} here.` };
}

export function emptyState(p: SudokuPuzzle): SudokuState {
  return { values: p.givens.slice(), notes: new Array(p.size * p.size).fill(0) };
}

export function makeSudokuLogic(id: string, size: number): GameLogic<SudokuPuzzle, SudokuSolution, SudokuState> {
  return {
    id,
    generate: (rng, difficulty) => generateSudoku(rng, difficulty, size),
    countSolutions,
    verify,
    progress: progressOf,
    hint,
  };
}
