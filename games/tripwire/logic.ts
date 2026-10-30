/**
 * Tripwire: minesweeper on a fixed daily board. The first tap is always safe: it opens a clear patch
 * around the published start tile. Every board is no-guess: a constraint solver (single numbers,
 * subset pairs, then exhaustive enumeration of each frontier component, then the mine total) clears
 * the whole board from that start without ever guessing. Boards that need a guess are thrown away.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export interface TripwirePuzzle {
  w: number;
  h: number;
  /** mine cells, ascending. The client needs them to answer taps offline; the server re-checks. */
  mines: number[];
  /** a zero tile; the first tap always opens the patch around it */
  start: number;
}
/** The mine cells (same as the puzzle's; kept so verify never trusts client data). */
export type TripwireSolution = number[];
/** 0 hidden, 1 revealed, 2 flagged, 3 tripped (a mine revealed by mistake) */
export type TripwireState = number[];

export const HIDDEN = 0;
export const OPEN = 1;
export const FLAG = 2;
export const TRIPPED = 3;

export const SHAPE: Record<Difficulty, { w: number; h: number; mines: number }> = {
  easy: { w: 7, h: 8, mines: 8 },
  medium: { w: 7, h: 10, mines: 12 },
  hard: { w: 7, h: 11, mines: 15 },
  expert: { w: 7, h: 12, mines: 19 },
  mega: { w: 9, h: 14, mines: 30 },
};

/* ---------------- Geometry ---------------- */

export function neighbours(w: number, h: number, i: number): number[] {
  const r = Math.floor(i / w),
    c = i % w;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr,
        cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < h && cc < w) out.push(rr * w + cc);
    }
  return out;
}

/** Mine count around each cell; -1 for mines. */
export function field(p: { w: number; h: number; mines: number[] }): number[] {
  const mine = new Set(p.mines);
  return Array.from({ length: p.w * p.h }, (_, i) => (mine.has(i) ? -1 : neighbours(p.w, p.h, i).filter((j) => mine.has(j)).length));
}

/** Cells a reveal at `i` opens: the cell itself, flooding through zeros. Never opens mines or flags. */
export function flood(p: TripwirePuzzle, f: number[], state: TripwireState, i: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    if (seen.has(j)) continue;
    seen.add(j);
    if (f[j] < 0 || state[j] === OPEN || state[j] === FLAG) continue;
    out.push(j);
    if (f[j] === 0) stack.push(...neighbours(p.w, p.h, j));
  }
  return out;
}

/* ---------------- Constraint solver ---------------- */

export interface Deduction {
  cell: number;
  mine: boolean;
  why: string;
}

/**
 * Deductions from what is visible: `open` cells show their numbers, `mine` cells are known mines.
 * Returns every cell the strongest needed technique settles, cheapest technique first.
 */
export function deduce(p: TripwirePuzzle, f: number[], open: boolean[], mine: boolean[]): Deduction[] {
  const { w, h } = p;
  const unknown = (j: number) => !open[j] && !mine[j];
  interface C {
    at: number;
    cells: number[];
    need: number;
  }
  const cons: C[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!open[i] || f[i] <= 0) continue;
    const nb = neighbours(w, h, i);
    const cells = nb.filter(unknown);
    if (!cells.length) continue;
    cons.push({ at: i, cells, need: f[i] - nb.filter((j) => mine[j]).length });
  }
  const where = (i: number) => `row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}`;
  // 1. A single number: already satisfied, or every hidden neighbour is a mine.
  for (const c of cons) {
    if (c.need === 0)
      return c.cells.map((cell) => ({
        cell,
        mine: false,
        why: `The ${f[c.at]} at ${where(c.at)} already has its mines. This tile is safe.`,
      }));
    if (c.need === c.cells.length)
      return c.cells.map((cell) => ({
        cell,
        mine: true,
        why: `The ${f[c.at]} at ${where(c.at)} needs every hidden tile around it. Flag this one.`,
      }));
  }
  // 2. Subset pairs: one number's hidden tiles sit inside another's.
  for (const a of cons) {
    for (const b of cons) {
      if (a === b || a.cells.length >= b.cells.length || !a.cells.every((x) => b.cells.includes(x))) continue;
      const diff = b.cells.filter((x) => !a.cells.includes(x));
      const extra = b.need - a.need;
      if (extra === 0)
        return diff.map((cell) => ({
          cell,
          mine: false,
          why: `Compare the ${f[a.at]} and the ${f[b.at]}: they share their mines, so this tile is safe.`,
        }));
      if (extra === diff.length)
        return diff.map((cell) => ({
          cell,
          mine: true,
          why: `Compare the ${f[a.at]} and the ${f[b.at]}: the extra mines must sit here. Flag it.`,
        }));
    }
  }
  // 3. Enumerate each connected frontier component; a tile with the same value in every fit is settled.
  const minesLeft = p.mines.length - mine.filter(Boolean).length;
  const frontier = [...new Set(cons.flatMap((c) => c.cells))];
  const seen = new Set<number>();
  const out: Deduction[] = [];
  for (const seed of frontier) {
    if (seen.has(seed)) continue;
    const comp: number[] = [];
    const stack = [seed];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      comp.push(x);
      for (const c of cons) if (c.cells.includes(x)) stack.push(...c.cells);
    }
    if (comp.length > 22) continue;
    const cc = cons.filter((c) => c.cells.some((x) => comp.includes(x)));
    const idx = new Map(comp.map((x, k) => [x, k]));
    const val = new Array<number>(comp.length).fill(-1);
    const mineHits = new Array<number>(comp.length).fill(0);
    let fits = 0;
    const ok = (final: boolean) =>
      cc.every((c) => {
        let m = 0,
          u = 0;
        for (const x of c.cells) {
          const v = val[idx.get(x)!];
          if (v === 1) m++;
          else if (v === -1) u++;
        }
        return final ? m === c.need : m <= c.need && m + u >= c.need;
      });
    const rec = (k: number, used: number) => {
      if (used > minesLeft || !ok(false)) return;
      if (k === comp.length) {
        if (!ok(true)) return;
        fits++;
        val.forEach((v, j) => (mineHits[j] += v));
        return;
      }
      for (const v of [0, 1]) {
        val[k] = v;
        rec(k + 1, used + v);
      }
      val[k] = -1;
    };
    rec(0, 0);
    if (!fits) continue;
    comp.forEach((x, k) => {
      if (mineHits[k] === 0) out.push({ cell: x, mine: false, why: "Every way the nearby numbers can be met leaves this tile safe." });
      else if (mineHits[k] === fits)
        out.push({ cell: x, mine: true, why: "Every way the nearby numbers can be met puts a mine here. Flag it." });
    });
    if (out.length) return out;
  }
  // 4. The mine total: none left, or exactly as many as hidden tiles.
  const hidden = Array.from({ length: w * h }, (_, i) => i).filter(unknown);
  if (hidden.length && minesLeft === 0) return hidden.map((cell) => ({ cell, mine: false, why: "Every mine is found. The rest is safe." }));
  if (hidden.length && minesLeft === hidden.length)
    return hidden.map((cell) => ({ cell, mine: true, why: "Only mines are left hidden. Flag it." }));
  return [];
}

/** Plays the board from the start patch using deductions only. */
export function solveFromStart(p: TripwirePuzzle): { solved: boolean; open: boolean[]; steps: number; enumerations: number } {
  const f = field(p);
  const n = p.w * p.h;
  const open = new Array<boolean>(n).fill(false);
  const mine = new Array<boolean>(n).fill(false);
  const blank = new Array<number>(n).fill(HIDDEN);
  const reveal = (i: number) =>
    flood(p, f, blank, i).forEach((j) => {
      blank[j] = OPEN;
      open[j] = true;
    });
  reveal(p.start);
  let steps = 0,
    enumerations = 0;
  for (;;) {
    const ds = deduce(p, f, open, mine);
    if (!ds.length) break;
    steps++;
    if (ds[0].why.startsWith("Every way")) enumerations++;
    for (const d of ds) {
      if (d.mine) mine[d.cell] = true;
      else if (!open[d.cell]) reveal(d.cell);
    }
  }
  const safe = f.filter((v) => v >= 0).length;
  return { solved: open.filter(Boolean).length === safe, open, steps, enumerations };
}

/**
 * Uniqueness for Tripwire means the layout is forced by what the player can see: 1 when the solver
 * clears the board from the start patch without a guess, otherwise 2 (some tile is not forced).
 */
export function countSolutions(p: TripwirePuzzle, limit = 2): number {
  return Math.min(limit, solveFromStart(p).solved ? 1 : 2);
}

/** 0..100 from size, mine density and how often full enumeration was needed. */
export function grade(p: TripwirePuzzle): number {
  const { enumerations } = solveFromStart(p);
  const density = p.mines.length / (p.w * p.h);
  return Math.max(0, Math.min(100, Math.round((p.w * p.h - 56) * 0.3 + density * 150 + enumerations * 3)));
}

/* ---------------- Generator ---------------- */

export function generate(rng: Rng, difficulty: Difficulty): Generated<TripwirePuzzle, TripwireSolution> {
  const { w, h, mines: count } = SHAPE[difficulty];
  for (let attempt = 0; attempt < 2000; attempt++) {
    const sr = rng.int(1, h - 2),
      sc = rng.int(1, w - 2);
    const start = sr * w + sc;
    const keepOut = new Set([start, ...neighbours(w, h, start)]);
    const pool = rng.shuffle(Array.from({ length: w * h }, (_, i) => i).filter((i) => !keepOut.has(i)));
    const mines = pool.slice(0, count).sort((a, b) => a - b);
    const p = { w, h, mines, start };
    if (solveFromStart(p).solved) return { puzzle: p, solution: mines.slice(), grade: grade(p) };
  }
  throw new Error(`tripwire: could not generate a no-guess ${w}x${h} board`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: TripwirePuzzle, state: unknown): state is TripwireState {
  return (
    Array.isArray(state) && state.length === p.w * p.h && state.every((v) => v === HIDDEN || v === OPEN || v === FLAG || v === TRIPPED)
  );
}

export function verify(p: TripwirePuzzle, sol: TripwireSolution, state: TripwireState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const mine = new Set(sol);
  if (state.some((v, i) => (v === OPEN && mine.has(i)) || (v === TRIPPED && !mine.has(i))))
    return { ok: false, progress: 0, reason: "impossible reveal" };
  const progress = progressOf(p, sol, state);
  return progress === 1 ? { ok: true, progress } : { ok: false, progress, reason: "safe tiles still hidden" };
}

export function progressOf(p: TripwirePuzzle, sol: TripwireSolution, state: TripwireState): number {
  if (!wellFormed(p, state)) return 0;
  const mine = new Set(sol);
  const safe = p.w * p.h - mine.size;
  return state.filter((v, i) => v === OPEN && !mine.has(i)).length / safe;
}

export function hint(p: TripwirePuzzle, sol: TripwireSolution, state: TripwireState): Hint | null {
  if (!wellFormed(p, state)) return null;
  const mine = new Set(sol);
  const badFlag = state.findIndex((v, i) => v === FLAG && !mine.has(i));
  if (badFlag >= 0) return { target: badFlag, text: "This flag sits on a safe tile." };
  if (progressOf(p, sol, state) === 1) return null;
  if (!state.includes(OPEN)) return { target: p.start, text: "Start here. It opens a clear patch." };
  const f = field({ ...p, mines: sol });
  const open = state.map((v) => v === OPEN);
  const known = state.map((v, i) => v === TRIPPED || (v === FLAG && mine.has(i)));
  // Prefer a safe tile the player has not opened, then a mine not yet flagged.
  const ds = deduce({ ...p, mines: sol }, f, open, known);
  const d = ds.find((x) => !x.mine) ?? ds[0];
  if (d) return { target: d.cell, text: d.why };
  const i = state.findIndex((v, k) => v === HIDDEN && !mine.has(k));
  return { target: i, text: "This tile is safe." };
}

const logic: GameLogic<TripwirePuzzle, TripwireSolution, TripwireState> = {
  id: "tripwire",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
