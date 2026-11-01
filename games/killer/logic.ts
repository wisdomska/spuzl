/**
 * Killer Sums: killer sudoku on the shared sudoku engine (games/_shared/sudoku/logic.ts). 6 × 6 with
 * 2 × 3 boxes on easy and medium, 9 × 9 from hard up. Every cell sits in a dotted cage whose digits add
 * to the cage total with no repeats, as well as the usual row, column and box rule.
 *
 * Generation: a random solved grid, cut into cages, then a backtracking solver with cage-sum pruning
 * proves the answer unique. When it is not, givens are added (one cell where two answers differ, each
 * time) until it is. Every level only keeps puzzles the hint engine can finish without guessing; from
 * hard up that can take the 45 rule (innies and outies), and where the engine still stalls a given
 * from the answer is added.
 */
import type { Difficulty, GameLogic, Generated, Hint } from "@/games/types";
import type { Rng } from "@/lib/rng";
import {
  BOX,
  emptyState,
  fullGrid,
  geometry,
  progressOf,
  verify as verifySudoku,
  type Cage,
  type SudokuPuzzle,
  type SudokuSolution,
  type SudokuState,
} from "@/games/_shared/sudoku/logic";
import { killerHints as t } from "@/lib/copy/killer";

export type { Cage } from "@/games/_shared/sudoku/logic";
export type KillerPuzzle = SudokuPuzzle & { cages: Cage[] };
export type KillerSolution = SudokuSolution;
export type KillerState = SudokuState;

export const SIZE_FOR: Record<Difficulty, number> = { easy: 6, medium: 6, hard: 9, expert: 9, mega: 9 };

interface Plan {
  /** cage sizes are drawn from this list (repeats weight the draw) */
  sizes: number[];
  /** the puzzle must fall to the hint engine's deductions (45 rule included) alone */
  logical: boolean;
}
const PLANS: Record<Difficulty, Plan> = {
  easy: { sizes: [2, 2, 2, 3], logical: true },
  medium: { sizes: [2, 3, 3, 4], logical: true },
  hard: { sizes: [2, 2, 3, 3, 4], logical: true },
  expert: { sizes: [2, 3, 3, 4, 4], logical: true },
  mega: { sizes: [2, 3, 4, 4, 5], logical: true },
};

const bits = (m: number) => {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
};
const digitsOf = (m: number) => {
  const out: number[] = [];
  for (let d = 1; m; d++, m >>= 1) if (m & 1) out.push(d);
  return out;
};

/* ---------------- Cage combinations ---------------- */

/**
 * allowed(avail, k, s): every digit that appears in some set of `k` distinct digits from `avail`
 * adding to `s`. Memoised per board size (9 × 9: 512 × 10 × 46 entries).
 */
const COMBOS = new Map<number, (avail: number, k: number, s: number) => number>();
export function comboTable(size: number) {
  const hit = COMBOS.get(size);
  if (hit) return hit;
  const maxSum = (size * (size + 1)) / 2;
  const byKS: number[][][] = Array.from({ length: size + 1 }, () => Array.from({ length: maxSum + 1 }, () => []));
  for (let m = 0; m < 1 << size; m++) {
    let s = 0;
    for (let d = 1; d <= size; d++) if (m & (1 << (d - 1))) s += d;
    byKS[bits(m)][s].push(m);
  }
  const memo = new Int32Array((1 << size) * (size + 1) * (maxSum + 1)).fill(-1);
  const fn = (avail: number, k: number, s: number) => {
    if (k < 0 || k > size || s < 0 || s > maxSum) return 0;
    const key = (avail * (size + 1) + k) * (maxSum + 1) + s;
    const m = memo[key];
    if (m >= 0) return m;
    let out = 0;
    for (const c of byKS[k][s]) if ((c & ~avail) === 0) out |= c;
    memo[key] = out;
    return out;
  };
  COMBOS.set(size, fn);
  return fn;
}

/** The digit sets of `k` distinct digits from 1..size adding to `s` (as bitmasks). */
export function combos(size: number, k: number, s: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < 1 << size; m++) {
    if (bits(m) !== k) continue;
    let sum = 0;
    for (let d = 1; d <= size; d++) if (m & (1 << (d - 1))) sum += d;
    if (sum === s) out.push(m);
  }
  return out;
}

/* ---------------- Solver ---------------- */

interface Index {
  cageOf: number[];
  rowOf: number[];
  colOf: number[];
  boxOf: number[];
}
function index(p: KillerPuzzle): Index {
  const n = p.size;
  const cageOf = new Array(n * n).fill(-1);
  p.cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  const rowOf: number[] = [],
    colOf: number[] = [],
    boxOf: number[] = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n),
      c = i % n;
    rowOf.push(r);
    colOf.push(c);
    boxOf.push(Math.floor(r / p.boxH) * (n / p.boxW) + Math.floor(c / p.boxW));
  }
  return { cageOf, rowOf, colOf, boxOf };
}

class Budget extends Error {}

/**
 * Backtracking with the most-constrained cell first. A cell's candidates are what its row, column and
 * box leave, cut down to the digits that can still complete its cage (remaining total, remaining cells,
 * digits already in the cage). Collects up to `limit` solutions; throws Budget past `maxNodes`.
 */
function solveKiller(p: KillerPuzzle, limit: number, maxNodes = Infinity): number[][] {
  const n = p.size,
    all = (1 << n) - 1;
  const allowed = comboTable(n);
  const ix = index(p);
  const values = p.givens.slice();
  const row = new Array(n).fill(0),
    col = new Array(n).fill(0),
    box = new Array(n).fill(0);
  const cageUsed = new Array(p.cages.length).fill(0),
    cageSum = new Array(p.cages.length).fill(0),
    cageLeft = p.cages.map((c) => c.cells.length);
  const out: number[][] = [];
  for (let i = 0; i < n * n; i++) {
    const d = values[i];
    if (!d) continue;
    const b = 1 << (d - 1),
      k = ix.cageOf[i];
    if (row[ix.rowOf[i]] & b || col[ix.colOf[i]] & b || box[ix.boxOf[i]] & b || cageUsed[k] & b) return out;
    row[ix.rowOf[i]] |= b;
    col[ix.colOf[i]] |= b;
    box[ix.boxOf[i]] |= b;
    cageUsed[k] |= b;
    cageSum[k] += d;
    cageLeft[k]--;
  }
  if (p.cages.some((c, k) => cageSum[k] > c.sum || (cageLeft[k] === 0 && cageSum[k] !== c.sum))) return out;
  const units = geometry(n, p.boxW, p.boxH).units.map((u) => u.cells);
  const masks = new Array(n * n).fill(0);
  let nodes = 0;
  const rec = () => {
    if (out.length >= limit) return;
    if (++nodes > maxNodes) throw new Budget();
    let best = -1,
      bestMask = 0,
      bestBits = 99;
    for (let i = 0; i < n * n; i++) {
      if (values[i]) continue;
      const k = ix.cageOf[i];
      const m =
        all &
        ~(row[ix.rowOf[i]] | col[ix.colOf[i]] | box[ix.boxOf[i]]) &
        allowed(all & ~cageUsed[k], cageLeft[k], p.cages[k].sum - cageSum[k]);
      masks[i] = m;
      const b = bits(m);
      if (b === 0) return;
      if (b < bestBits) {
        best = i;
        bestMask = m;
        bestBits = b;
      }
    }
    if (best < 0) {
      out.push(values.slice());
      return;
    }
    // Hidden singles: a digit with no home in a row, column or box is a dead end; one home is forced.
    if (bestBits > 1) {
      for (const cells of units) {
        let once = 0,
          twice = 0,
          placed = 0;
        for (const i of cells) {
          if (values[i]) placed |= 1 << (values[i] - 1);
          else {
            twice |= once & masks[i];
            once |= masks[i];
          }
        }
        if ((once | placed) !== all) return;
        const single = once & ~twice & ~placed;
        if (single) {
          const bit = single & -single;
          best = cells.find((i) => !values[i] && masks[i] & bit)!;
          bestMask = bit;
          break;
        }
      }
    }
    const k = ix.cageOf[best];
    for (const d of digitsOf(bestMask)) {
      const b = 1 << (d - 1);
      values[best] = d;
      row[ix.rowOf[best]] |= b;
      col[ix.colOf[best]] |= b;
      box[ix.boxOf[best]] |= b;
      cageUsed[k] |= b;
      cageSum[k] += d;
      cageLeft[k]--;
      rec();
      values[best] = 0;
      row[ix.rowOf[best]] &= ~b;
      col[ix.colOf[best]] &= ~b;
      box[ix.boxOf[best]] &= ~b;
      cageUsed[k] &= ~b;
      cageSum[k] -= d;
      cageLeft[k]++;
      if (out.length >= limit) return;
    }
  };
  rec();
  return out;
}

export function countSolutions(p: KillerPuzzle, limit = 2): number {
  return solveKiller(p, limit).length;
}

export function solve(p: KillerPuzzle): KillerSolution | null {
  return solveKiller(p, 1)[0] ?? null;
}

/* ---------------- Deductions (hints) ---------------- */

export interface KillerDeduction {
  cell: number;
  value: number;
  why: string;
}

const list = (ds: number[]) => (ds.length === 1 ? `${ds[0]}` : `${ds.slice(0, -1).join(", ")} and ${ds[ds.length - 1]}`);

interface CageView {
  /** digit sets (bitmasks) the whole cage can still be, placed digits included */
  sets: number[];
  /** digits each open cell can take in some valid completion */
  cellMask: Map<number, number>;
}

/** Every way to finish a cage from the open cells' candidates: which digit sets work and where each digit can go. */
function viewCage(cage: Cage, values: number[], masks: number[]): CageView {
  let used = 0,
    sum = 0;
  const open: number[] = [];
  for (const i of cage.cells) {
    if (values[i]) {
      used |= 1 << (values[i] - 1);
      sum += values[i];
    } else open.push(i);
  }
  const cellMask = new Map<number, number>(open.map((i) => [i, 0]));
  const sets = new Set<number>();
  const pick: number[] = [];
  const rec = (k: number, mask: number, left: number) => {
    if (k === open.length) {
      if (left !== 0) return;
      sets.add(mask);
      open.forEach((i, j) => cellMask.set(i, cellMask.get(i)! | (1 << (pick[j] - 1))));
      return;
    }
    for (const d of digitsOf(masks[open[k]] & ~mask)) {
      if (d > left) break;
      pick[k] = d;
      rec(k + 1, mask | (1 << (d - 1)), left - d);
    }
  };
  rec(0, used, cage.sum - sum);
  return { sets: [...sets], cellMask };
}

/* ---------------- The 45 rule (innies and outies) ---------------- */

/**
 * A sum the 45 rule gives over a few loose cells. Every row, column and box adds to 45 (21 on 6 × 6), so
 * for a strip of rows, columns or one box: the cells inside it that belong to cages crossing its edge
 * ("innies") add to the strip's total less the cages wholly inside it, and the cells those crossing
 * cages have outside it ("outies") add to the crossing cages' totals less the innies.
 */
export interface Rule45 {
  cells: number[];
  sum: number;
  /** the region it comes from, as a person names it: "row 3", "columns 1 to 2", "box 5" */
  where: string;
  /** what the region adds to */
  total: number;
  side: "in" | "out";
}

/** Loose cells past this many make a sum too wide to help a person (or to enumerate cheaply). */
const RULE45_MAX_CELLS = 5;

const RULE45 = new WeakMap<Cage[], Rule45[]>();

/** Every useful 45-rule sum for this cage layout. It depends only on the cages, so it is worked out once. */
export function rule45(p: KillerPuzzle): Rule45[] {
  const hit = RULE45.get(p.cages);
  if (hit) return hit;
  const n = p.size;
  const unitSum = (n * (n + 1)) / 2;
  const g = geometry(n, p.boxW, p.boxH);
  const ix = index(p);
  const regions: { cells: number[]; where: string; units: number }[] = [];
  const strip = (kind: "row" | "column") => {
    const us = g.units.filter((u) => u.kind === kind);
    for (let len = 1; len <= Math.min(4, n - 1); len++)
      for (let a = 0; a + len <= n; a++) {
        const where = len === 1 ? `${kind} ${a + 1}` : `${kind}s ${a + 1} to ${a + len}`;
        regions.push({ cells: us.slice(a, a + len).flatMap((u) => u.cells), where, units: len });
      }
  };
  strip("row");
  strip("column");
  for (const u of g.units) if (u.kind === "box") regions.push({ cells: u.cells, where: `box ${u.index + 1}`, units: 1 });
  const out: Rule45[] = [];
  const seen = new Set<string>();
  const add = (cells: number[], sum: number, where: string, total: number, side: Rule45["side"]) => {
    if (!cells.length || cells.length > RULE45_MAX_CELLS) return;
    const key = cells
      .slice()
      .sort((a, b) => a - b)
      .join(",");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ cells, sum, where, total, side });
  };
  for (const r of regions) {
    const inside = new Set(r.cells);
    const total = unitSum * r.units;
    let whole = 0,
      crossing = 0;
    const innies: number[] = [],
      outies: number[] = [];
    const cagesHere = new Set(r.cells.map((i) => ix.cageOf[i]));
    for (const k of cagesHere) {
      const cage = p.cages[k];
      if (cage.cells.every((i) => inside.has(i))) whole += cage.sum;
      else {
        crossing += cage.sum;
        for (const i of cage.cells) (inside.has(i) ? innies : outies).push(i);
      }
    }
    const inSum = total - whole;
    add(innies, inSum, r.where, total, "in");
    add(outies, crossing - inSum, r.where, total, "out");
  }
  RULE45.set(p.cages, out);
  return out;
}

/** The digits each open cell of a 45-rule sum can take in some completion that keeps peers distinct. */
function viewRule45(r: Rule45, values: number[], masks: number[], peers: Set<number>[]): Map<number, number> | null {
  let left = r.sum;
  const open: number[] = [];
  for (const i of r.cells) {
    if (values[i]) left -= values[i];
    else open.push(i);
  }
  if (!open.length) return null;
  open.sort((a, b) => bits(masks[a]) - bits(masks[b]));
  const cellMask = new Map<number, number>(open.map((i) => [i, 0]));
  const pick: number[] = [];
  let any = false;
  const rec = (k: number, rest: number) => {
    if (k === open.length) {
      if (rest !== 0) return;
      any = true;
      open.forEach((i, j) => cellMask.set(i, cellMask.get(i)! | (1 << (pick[j] - 1))));
      return;
    }
    const i = open[k];
    // The cells still to fill need at least 1 each.
    const after = open.length - k - 1;
    for (const d of digitsOf(masks[i])) {
      if (d + after > rest) break;
      let clash = false;
      for (let j = 0; j < k; j++) if (pick[j] === d && peers[i].has(open[j])) clash = true;
      if (clash) continue;
      pick[k] = d;
      rec(k + 1, rest - d);
    }
  };
  rec(0, left);
  return any ? cellMask : null;
}

const PEERS = new WeakMap<Cage[], Set<number>[]>();
/** Cells that can't share a digit: the same row, column, box or cage. */
function peerSets(p: KillerPuzzle, ix: Index): Set<number>[] {
  const hit = PEERS.get(p.cages);
  if (hit) return hit;
  const g = geometry(p.size, p.boxW, p.boxH);
  const out = g.peers.map((ps, i) => new Set([...ps, ...p.cages[ix.cageOf[i]].cells.filter((j) => j !== i)]));
  PEERS.set(p.cages, out);
  return out;
}

/**
 * One placement a person can find, with a one-sentence reason: a single candidate (from the cage total,
 * the cage's only digit set, or its row, column and box), then a hidden single in a row, column, box
 * or cage. Cage views are refined to a fixpoint first, so a forced digit set narrows the cells around it.
 * Only when those run dry does it bring in the 45 rule, so easy steps keep their plain reasons.
 */
export function nextDeduction(p: KillerPuzzle, values: number[], use45 = true): KillerDeduction | null {
  return deduce(p, values, false) ?? (use45 ? deduce(p, values, true) : null);
}

function deduce(p: KillerPuzzle, values: number[], use45: boolean): KillerDeduction | null {
  const n = p.size;
  const g = geometry(n, p.boxW, p.boxH);
  const ix = index(p);
  const sums = use45 ? rule45(p) : [];
  const peers = use45 ? peerSets(p, ix) : [];
  /** the 45-rule sum that last narrowed a cell, for its reason */
  const by45 = new Map<number, Rule45>();
  const peerMask = values.map((v, i) => {
    if (v) return 0;
    let m = g.all;
    for (const j of g.peers[i]) if (values[j]) m &= ~(1 << (values[j] - 1));
    for (const j of p.cages[ix.cageOf[i]].cells) if (values[j]) m &= ~(1 << (values[j] - 1));
    return m;
  });
  const masks = peerMask.slice();
  // Look for a step after each refinement round, so easy steps keep their plain reasons.
  for (let round = 0; round < 8; round++) {
    const views = p.cages.map((c) => viewCage(c, values, masks));
    let changed = false;
    views.forEach((v) =>
      v.cellMask.forEach((m, i) => {
        if ((masks[i] & m) !== masks[i]) {
          masks[i] &= m;
          changed = true;
        }
      }),
    );
    for (const r of sums) {
      const m = viewRule45(r, values, masks, peers);
      m?.forEach((mask, i) => {
        if ((masks[i] & mask) !== masks[i]) {
          masks[i] &= mask;
          by45.set(i, r);
          changed = true;
        }
      });
    }
    const found = findStep(p, values, masks, peerMask, views, ix, by45);
    if (found) return found;
    // A digit every completion of a cage uses leaves the rest of a row, column or box the cage's spots share.
    p.cages.forEach((cage, k) => {
      const open = cage.cells.filter((i) => !values[i]);
      if (!open.length || !views[k].sets.length) return;
      const must = views[k].sets.reduce((a, s) => a & s, g.all);
      for (const d of digitsOf(must)) {
        const b = 1 << (d - 1);
        if (cage.cells.some((i) => values[i] === d)) continue;
        const spots = open.filter((i) => masks[i] & b);
        if (!spots.length) continue;
        for (const u of g.units) {
          if (!spots.every((i) => u.cells.includes(i))) continue;
          for (const j of u.cells) {
            if (!values[j] && ix.cageOf[j] !== k && masks[j] & b) {
              masks[j] &= ~b;
              changed = true;
            }
          }
        }
      }
    });
    if (!changed) return null;
  }
  return null;
}

function findStep(
  p: KillerPuzzle,
  values: number[],
  masks: number[],
  peerMask: number[],
  views: CageView[],
  ix: Index,
  by45: Map<number, Rule45>,
): KillerDeduction | null {
  const n = p.size;
  const g = geometry(n, p.boxW, p.boxH);
  // Single candidates, explained by the simplest reason that holds.
  for (let i = 0; i < n * n; i++) {
    if (values[i] || bits(masks[i]) !== 1) continue;
    const d = digitsOf(masks[i])[0];
    const r = by45.get(i);
    if (r) {
      const where = r.where;
      if (r.cells.length === 1)
        return { cell: i, value: d, why: r.side === "in" ? t.innie(where, r.total, d) : t.outie(where, r.total, d) };
      return { cell: i, value: d, why: r.side === "in" ? t.innies(where, r.total, r.sum, d) : t.outies(where, r.total, r.sum, d) };
    }
    const k = ix.cageOf[i];
    const cage = p.cages[k];
    const open = cage.cells.filter((j) => !values[j]);
    if (cage.cells.length === 1) return { cell: i, value: d, why: t.single(cage.sum) };
    if (open.length === 1) return { cell: i, value: d, why: t.lastCell(cage.sum, d) };
    const all = combos(n, cage.cells.length, cage.sum);
    if (all.length === 1) return { cell: i, value: d, why: t.onlySet(cage.cells.length, cage.sum, list(digitsOf(all[0])), d) };
    if (bits(peerMask[i]) === 1) return { cell: i, value: d, why: t.onlyFits(d) };
    if (views[k].sets.length === 1)
      return { cell: i, value: d, why: t.onlySetNow(cage.cells.length, cage.sum, list(digitsOf(views[k].sets[0])), d) };
    return { cell: i, value: d, why: t.withCage(d, cage.sum) };
  }
  // Hidden singles in a row, column or box.
  for (const u of g.units) {
    for (let d = 1; d <= n; d++) {
      const b = 1 << (d - 1);
      if (u.cells.some((i) => values[i] === d)) continue;
      const spots = u.cells.filter((i) => !values[i] && masks[i] & b);
      if (spots.length === 1) {
        const where = u.kind === "box" ? t.thisBox : `${u.kind} ${u.index + 1}`;
        return { cell: spots[0], value: d, why: t.onlySpot(d, where) };
      }
    }
  }
  // Hidden singles in a cage: a digit every completion uses, with one place left for it.
  for (let k = 0; k < p.cages.length; k++) {
    const cage = p.cages[k];
    if (!views[k].sets.length) continue;
    const must = views[k].sets.reduce((a, s) => a & s, g.all);
    for (const d of digitsOf(must)) {
      if (cage.cells.some((i) => values[i] === d)) continue;
      const spots = cage.cells.filter((i) => !values[i] && masks[i] & (1 << (d - 1)));
      if (spots.length === 1) return { cell: spots[0], value: d, why: t.cageNeeds(cage.sum, d) };
    }
  }
  return null;
}

/** Fills the grid with deductions only, from `start` (the givens by default), and returns where it stops. */
function fillByLogic(p: KillerPuzzle, start = p.givens, use45 = true): number[] {
  const values = start.slice();
  for (;;) {
    const d = nextDeduction(p, values, use45);
    if (!d) return values;
    values[d.cell] = d.value;
  }
}

/** True when the hint engine finishes the grid without a guess. */
export function solvesByLogic(p: KillerPuzzle): boolean {
  return !fillByLogic(p).includes(0);
}

/* ---------------- Generator ---------------- */

/** Cuts a solved grid into connected cages with no repeated digit, sizes drawn from the plan. */
function partition(rng: Rng, sol: number[], size: number, plan: Plan): Cage[] {
  const n = size * size;
  const cageOf = new Array(n).fill(-1);
  const groups: number[][] = [];
  const nb = (i: number) => {
    const r = Math.floor(i / size),
      c = i % size;
    const out: number[] = [];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  };
  const canJoin = (cells: number[], j: number) => cells.every((i) => sol[i] !== sol[j]);
  for (const start of rng.shuffle(Array.from({ length: n }, (_, i) => i))) {
    if (cageOf[start] >= 0) continue;
    const target = rng.pick(plan.sizes);
    const cells = [start];
    cageOf[start] = groups.length;
    while (cells.length < target) {
      const frontier = [...new Set(cells.flatMap(nb))].filter((j) => cageOf[j] < 0 && canJoin(cells, j));
      if (!frontier.length) break;
      const j = rng.pick(frontier);
      cells.push(j);
      cageOf[j] = groups.length;
    }
    groups.push(cells);
  }
  // Fold single cells into a neighbouring cage when a digit-safe one exists (a 1-cell cage is a given in disguise).
  const max = Math.max(...plan.sizes) + 1;
  for (let k = 0; k < groups.length; k++) {
    if (groups[k].length !== 1) continue;
    const i = groups[k][0];
    const into = rng
      .shuffle(nb(i).map((j) => cageOf[j]))
      .find((o) => o !== k && groups[o].length > 0 && groups[o].length < max && canJoin(groups[o], i));
    if (into === undefined) continue;
    groups[into].push(i);
    cageOf[i] = into;
    groups[k] = [];
  }
  return groups
    .filter((c) => c.length)
    .map((cells) => {
      const sorted = cells.slice().sort((a, b) => a - b);
      return { cells: sorted, sum: sorted.reduce((a, i) => a + sol[i], 0) };
    })
    .sort((a, b) => a.cells[0] - b.cells[0]);
}

export function grade(p: KillerPuzzle): number {
  const avg = (p.size * p.size) / p.cages.length;
  const givens = p.givens.filter(Boolean).length;
  const base = p.size === 9 ? 40 : 0;
  // Harder when the plain cage and sudoku steps run dry and the 45 rule (or a guess) is needed.
  const plain = !fillByLogic(p, p.givens, false).includes(0);
  return Math.max(0, Math.min(100, Math.round(base + (avg - 2) * 18 - givens * 2 + (plain ? 0 : 15))));
}

/** Node budget per uniqueness check while generating: past it, a cell of the biggest open cage is pinned. */
const NODE_BUDGET = 20000;
/** Givens allowed before a cut is thrown away for a better one. */
const MAX_GIVENS: Record<number, number> = { 6: 4, 9: 8 };

export function generate(rng: Rng, difficulty: Difficulty): Generated<KillerPuzzle, KillerSolution> {
  const size = SIZE_FOR[difficulty];
  const [boxW, boxH] = BOX[size];
  const plan = PLANS[difficulty];
  let fallback: Generated<KillerPuzzle, KillerSolution> | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const sol = fullGrid(rng, size);
    const p: KillerPuzzle = { size, boxW, boxH, givens: new Array(size * size).fill(0), cages: partition(rng, sol, size, plan) };
    let unique = false;
    for (let added = 0; added <= MAX_GIVENS[size]; added++) {
      let found: number[][] | null = null;
      try {
        found = solveKiller(p, 2, NODE_BUDGET);
      } catch (e) {
        if (!(e instanceof Budget)) throw e;
      }
      if (found?.length === 1) {
        unique = true;
        break;
      }
      // Pin a cell where another answer differs from ours (or, past the search budget, a cell of the
      // biggest open cage), then check again.
      const other = found?.find((s) => s.some((d, i) => d !== sol[i]));
      const open = other
        ? other.flatMap((d, i) => (d !== sol[i] ? [i] : []))
        : (p.cages
            .filter((c) => c.cells.some((i) => !p.givens[i]))
            .sort((a, b) => b.cells.length - a.cells.length)[0]
            ?.cells.filter((i) => !p.givens[i]) ?? []);
      if (!open.length) break;
      const pin = rng.pick(open);
      p.givens[pin] = sol[pin];
    }
    if (!unique) continue;
    let logical = !plan.logical;
    if (plan.logical) {
      // Where the hint engine stalls, a given from the answer (in the smallest cage still open) unblocks
      // it; the answer stays unique since givens only remove options.
      let values = fillByLogic(p);
      while (values.includes(0) && p.givens.filter(Boolean).length < MAX_GIVENS[size]) {
        const open = values.flatMap((v, i) => (v ? [] : [i]));
        const ix = index(p);
        const smallest = Math.min(...open.map((i) => p.cages[ix.cageOf[i]].cells.length));
        const pin = rng.pick(open.filter((i) => p.cages[ix.cageOf[i]].cells.length === smallest));
        p.givens[pin] = sol[pin];
        values[pin] = sol[pin];
        values = fillByLogic(p, values);
      }
      logical = !values.includes(0) && solvesByLogic(p);
    }
    const g = { puzzle: p, solution: sol, grade: grade(p) };
    if (logical) return g;
    fallback ??= g;
  }
  if (fallback) return fallback;
  throw new Error(`killer: could not generate a ${difficulty} puzzle`);
}

/* ---------------- Verify, progress, hint ---------------- */

/** Same checks as every sudoku (givens kept, rules and cages hold, matches the answer). */
export const verify = (p: KillerPuzzle, sol: KillerSolution, state: KillerState) => verifySudoku(p, sol, state);
export const progress = (p: KillerPuzzle, sol: KillerSolution, state: KillerState) => progressOf(p, sol, state);

export function hint(p: KillerPuzzle, sol: KillerSolution, state: KillerState): Hint | null {
  // Before the first move there is no saved state yet: hint from the givens.
  const v = Array.isArray(state?.values) && state.values.length === p.size * p.size ? state.values : p.givens;
  const wrong = v.findIndex((d, i) => d && d !== sol[i]);
  if (wrong >= 0) return { target: wrong, text: t.wrong(v[wrong]) };
  if (!v.includes(0)) return null;
  const d = nextDeduction(p, v);
  if (d) return { target: d.cell, text: d.why };
  // No single step left for a person: reveal the open cell in the smallest cage.
  const ix = index(p);
  let best = -1;
  v.forEach((x, i) => {
    if (!x && (best < 0 || p.cages[ix.cageOf[i]].cells.length < p.cages[ix.cageOf[best]].cells.length)) best = i;
  });
  return best < 0 ? null : { target: best, text: t.reveal(sol[best]) };
}

export { emptyState };

const logic: GameLogic<KillerPuzzle, KillerSolution, KillerState> = { id: "killer", generate, countSolutions, verify, progress, hint };
export default logic;
