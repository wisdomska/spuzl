/**
 * Quilt (Shikaku family): split the grid into rectangles so each rectangle holds exactly one clue,
 * and that clue equals its area. Generator builds a random rectangle partition, places one clue per
 * rectangle and keeps only layouts the exact-cover solver proves unique.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

/** [row, col, height, width] */
export type Rect = [number, number, number, number];

export interface QuiltPuzzle {
  rows: number;
  cols: number;
  /** [cell index, area] for every clue, sorted by index */
  clues: [number, number][];
}
/** one rectangle per clue, in clue order */
export type QuiltSolution = Rect[];
/** rectangles the player has drawn, any order */
export type QuiltState = Rect[];

export const SIZE_FOR: Record<Difficulty, number> = { easy: 6, medium: 7, hard: 8, expert: 9, mega: 10 };
/** largest rectangle area the partition may use, per difficulty */
const MAX_AREA: Record<Difficulty, number> = { easy: 8, medium: 9, hard: 10, expert: 12, mega: 12 };

export type QuiltBreak = "none" | "many" | "area" | "overlap" | "bounds";
export const BREAK_COPY: Record<Exclude<QuiltBreak, "overlap" | "bounds">, string> = {
  none: "Every rectangle needs one number.",
  many: "One number per rectangle.",
  area: "The area must match the number.",
};

export const area = (r: Rect) => r[2] * r[3];
export const rectCells = (p: { cols: number }, [r, c, h, w]: Rect) => {
  const out: number[] = [];
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) out.push(y * p.cols + x);
  return out;
};
export const inRect = ([r, c, h, w]: Rect, y: number, x: number) => y >= r && y < r + h && x >= c && x < c + w;
export const sameRect = (a: Rect, b: Rect) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** Rectangle spanning two corner cells. */
export function spanRect(cols: number, a: number, b: number): Rect {
  const ra = Math.floor(a / cols),
    ca = a % cols,
    rb = Math.floor(b / cols),
    cb = b % cols;
  return [Math.min(ra, rb), Math.min(ca, cb), Math.abs(ra - rb) + 1, Math.abs(ca - cb) + 1];
}

/** What is wrong with a single rectangle, ignoring the others. */
export function rectBreak(p: QuiltPuzzle, rect: Rect): QuiltBreak | null {
  const inside = p.clues.filter(([i]) => inRect(rect, Math.floor(i / p.cols), i % p.cols));
  if (inside.length === 0) return "none";
  if (inside.length > 1) return "many";
  if (inside[0][1] !== area(rect)) return "area";
  return null;
}

export interface Analysis {
  /** indexes into the state of rectangles that break a rule */
  bad: Set<number>;
  message: string;
  covered: number;
  clear: boolean;
}

export function analyze(p: QuiltPuzzle, state: QuiltState): Analysis {
  const bad = new Set<number>();
  let message = "";
  let covered = 0;
  state.forEach((rect, k) => {
    const b = rectBreak(p, rect);
    covered += area(rect);
    if (b && b !== "overlap" && b !== "bounds") {
      bad.add(k);
      message ||= BREAK_COPY[b];
    }
  });
  return { bad, message, covered, clear: bad.size === 0 && covered === p.rows * p.cols && !overlaps(p, state) };
}

function overlaps(p: QuiltPuzzle, state: QuiltState): boolean {
  const seen = new Uint8Array(p.rows * p.cols);
  for (const r of state)
    for (const i of rectCells(p, r)) {
      if (seen[i]) return true;
      seen[i] = 1;
    }
  return false;
}

/* ---------------- Solver ---------------- */

/** Every rectangle of the clue's area that contains the clue and no other clue. */
export function candidates(p: QuiltPuzzle): Rect[][] {
  const clueAt = new Map(p.clues.map(([i, n]) => [i, n]));
  return p.clues.map(([i, n]) => {
    const r0 = Math.floor(i / p.cols),
      c0 = i % p.cols;
    const out: Rect[] = [];
    for (let h = 1; h <= n; h++) {
      if (n % h) continue;
      const w = n / h;
      for (let r = r0 - h + 1; r <= r0; r++) {
        for (let c = c0 - w + 1; c <= c0; c++) {
          if (r < 0 || c < 0 || r + h > p.rows || c + w > p.cols) continue;
          let clean = true;
          for (let y = r; y < r + h && clean; y++)
            for (let x = c; x < c + w; x++) {
              const j = y * p.cols + x;
              if (j !== i && clueAt.has(j)) {
                clean = false;
                break;
              }
            }
          if (clean) out.push([r, c, h, w]);
        }
      }
    }
    return out;
  });
}

/**
 * Exact cover search. The first uncovered cell in reading order must be the top-left corner of the
 * rectangle that covers it, so candidates are indexed by their top-left cell.
 */
function search(p: QuiltPuzzle, limit: number, fixed: Rect[] = [], onSolution?: (s: Rect[]) => boolean | void): number {
  const n = p.rows * p.cols;
  const cand = candidates(p);
  const byCorner: [number, Rect][][] = Array.from({ length: n }, () => []);
  cand.forEach((list, k) => list.forEach((r) => byCorner[r[0] * p.cols + r[1]].push([k, r])));
  const covered = new Uint8Array(n);
  const used = new Uint8Array(p.clues.length);
  const chosen: Rect[] = new Array(p.clues.length);
  // Pre-place fixed rectangles (must be candidates).
  for (const f of fixed) {
    const k = cand.findIndex((list) => list.some((r) => sameRect(r, f)));
    if (k < 0 || used[k]) return 0;
    for (const i of rectCells(p, f)) {
      if (covered[i]) return 0;
      covered[i] = 1;
    }
    used[k] = 1;
    chosen[k] = f;
  }
  const fits = (r: Rect) => {
    for (let y = r[0]; y < r[0] + r[2]; y++) for (let x = r[1]; x < r[1] + r[3]; x++) if (covered[y * p.cols + x]) return false;
    return true;
  };
  const mark = (r: Rect, v: number) => {
    for (let y = r[0]; y < r[0] + r[2]; y++) for (let x = r[1]; x < r[1] + r[3]; x++) covered[y * p.cols + x] = v;
  };
  // Forward check: every unused clue keeps at least one rectangle that still fits.
  const alive = () => {
    for (let k = 0; k < cand.length; k++) if (!used[k] && !cand[k].some(fits)) return false;
    return true;
  };
  let count = 0;
  let stop = false;
  const rec = (from: number) => {
    if (stop) return;
    let i = from;
    while (i < n && covered[i]) i++;
    if (i === n) {
      count++;
      if (onSolution?.(chosen.slice()) || count >= limit) stop = true;
      return;
    }
    for (const [k, r] of byCorner[i]) {
      if (used[k] || !fits(r)) continue;
      used[k] = 1;
      chosen[k] = r;
      mark(r, 1);
      if (alive()) rec(i + 1);
      mark(r, 0);
      used[k] = 0;
      if (stop) return;
    }
  };
  if (alive()) rec(0);
  return count;
}

export function countSolutions(p: QuiltPuzzle, limit = 2): number {
  return search(p, limit);
}

export function solve(p: QuiltPuzzle, fixed: Rect[] = []): QuiltSolution | null {
  let out: Rect[] | null = null;
  search(p, 1, fixed, (s) => {
    out = s;
    return true;
  });
  return out;
}

/* ---------------- Deductions (grader + hints) ---------------- */

/**
 * A clue whose only rectangle that still fits around the placed ones is forced.
 * Returns the clue index and the rectangle.
 */
export function nextDeduction(p: QuiltPuzzle, placed: Rect[]): { clue: number; rect: Rect } | null {
  const cand = candidates(p);
  const covered = new Uint8Array(p.rows * p.cols);
  for (const r of placed) for (const i of rectCells(p, r)) covered[i] = 1;
  const done = new Set(placed.map((r) => cand.findIndex((l) => l.some((x) => sameRect(x, r)))));
  // single candidate per clue
  for (let k = 0; k < cand.length; k++) {
    if (done.has(k)) continue;
    const ok = cand[k].filter((r) => rectCells(p, r).every((i) => !covered[i]));
    if (ok.length === 1) return { clue: k, rect: ok[0] };
  }
  // a free cell reachable by only one clue's rectangles, which all agree
  const n = p.rows * p.cols;
  for (let i = 0; i < n; i++) {
    if (covered[i]) continue;
    const owners: [number, Rect][] = [];
    for (let k = 0; k < cand.length; k++) {
      if (done.has(k)) continue;
      for (const r of cand[k])
        if (inRect(r, Math.floor(i / p.cols), i % p.cols) && rectCells(p, r).every((j) => !covered[j])) owners.push([k, r]);
    }
    if (owners.length === 1) return { clue: owners[0][0], rect: owners[0][1] };
  }
  return null;
}

/** 0..100: share of the board simple deductions cannot reach, plus board size. */
export function grade(p: QuiltPuzzle): number {
  const placed: Rect[] = [];
  for (;;) {
    const d = nextDeduction(p, placed);
    if (!d) break;
    placed.push(d.rect);
  }
  const reached = placed.reduce((s, r) => s + area(r), 0) / (p.rows * p.cols);
  const sizeBase = (p.rows - 5) * 9;
  return Math.max(0, Math.min(100, Math.round(sizeBase + (1 - reached) * 55)));
}

/* ---------------- Generator ---------------- */

/** Random partition into rectangles: repeatedly take the first free cell and grow a random rectangle there. */
function partition(rows: number, cols: number, maxArea: number, rng: Rng): Rect[] {
  const used = new Uint8Array(rows * cols);
  const out: Rect[] = [];
  for (let i = 0; i < rows * cols; i++) {
    if (used[i]) continue;
    const r = Math.floor(i / cols),
      c = i % cols;
    // max width from this corner
    let maxW = 0;
    while (c + maxW < cols && !used[r * cols + c + maxW]) maxW++;
    const options: Rect[] = [];
    for (let w = 1; w <= maxW; w++) {
      for (let h = 1; r + h <= rows; h++) {
        if (w * h > maxArea) break;
        let free = true;
        for (let x = c; x < c + w; x++) if (used[(r + h - 1) * cols + x]) free = false;
        if (!free) break;
        options.push([r, c, h, w]);
      }
    }
    // weight: prefer areas 2..6, keep 1×1 rare
    const weighted = options.flatMap((o) => {
      const a = area(o);
      const wt = a === 1 ? 1 : a <= 6 ? 6 : 3;
      return Array<Rect>(wt).fill(o);
    });
    const pick = rng.pick(weighted);
    out.push(pick);
    for (const j of rectCells({ cols }, pick)) used[j] = 1;
  }
  return out;
}

/** Unique candidates sampled per difficulty; the hardest (by grade) wins, so later days need more than forced moves. */
const SAMPLES: Record<Difficulty, number> = { easy: 1, medium: 1, hard: 3, expert: 6, mega: 6 };

export function generate(rng: Rng, difficulty: Difficulty): Generated<QuiltPuzzle, QuiltSolution> {
  const pool: Generated<QuiltPuzzle, QuiltSolution>[] = [];
  while (pool.length < SAMPLES[difficulty]) pool.push(generateOne(rng, difficulty));
  return pool.reduce((a, b) => (b.grade > a.grade ? b : a));
}

function generateOne(rng: Rng, difficulty: Difficulty): Generated<QuiltPuzzle, QuiltSolution> {
  const n = SIZE_FOR[difficulty];
  for (let attempt = 0; attempt < 500; attempt++) {
    const rects = partition(n, n, MAX_AREA[difficulty], rng);
    if (rects.filter((r) => area(r) === 1).length > Math.ceil(n / 3)) continue;
    // Try a few clue placements for this partition.
    for (let t = 0; t < 6; t++) {
      const pairs = rects.map((r) => {
        const cells = rectCells({ cols: n }, r);
        return [rng.pick(cells), area(r)] as [number, number];
      });
      const order = pairs.map((x, k) => [x, k] as const).sort((a, b) => a[0][0] - b[0][0]);
      const puzzle: QuiltPuzzle = { rows: n, cols: n, clues: order.map(([x]) => x) };
      if (countSolutions(puzzle, 2) !== 1) continue;
      const solution = order.map(([, k]) => rects[k]);
      return { puzzle, solution, grade: grade(puzzle) };
    }
  }
  throw new Error(`quilt: could not generate a unique ${n}x${n} puzzle`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: QuiltPuzzle, state: unknown): state is QuiltState {
  if (!Array.isArray(state) || state.length > p.rows * p.cols) return false;
  return state.every(
    (r) =>
      Array.isArray(r) &&
      r.length === 4 &&
      r.every((v) => Number.isInteger(v)) &&
      r[0] >= 0 &&
      r[1] >= 0 &&
      r[2] >= 1 &&
      r[3] >= 1 &&
      r[0] + r[2] <= p.rows &&
      r[1] + r[3] <= p.cols,
  );
}

/** Correct rectangles' area over the board. Wrong rectangles score nothing, so progress leaks no shape. */
export function progress(p: QuiltPuzzle, sol: QuiltSolution, state: QuiltState): number {
  if (!wellFormed(p, state)) return 0;
  const good = state.filter((r) => sol.some((s) => sameRect(s, r)));
  return good.reduce((s, r) => s + area(r), 0) / (p.rows * p.cols);
}

export function verify(p: QuiltPuzzle, sol: QuiltSolution, state: QuiltState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const prog = progress(p, sol, state);
  if (overlaps(p, state)) return { ok: false, progress: prog, reason: "overlap" };
  const a = analyze(p, state);
  if (!a.clear) return { ok: false, progress: prog, reason: a.message || "incomplete" };
  const match = sol.every((s) => state.some((r) => sameRect(r, s)));
  return match ? { ok: true, progress: 1 } : { ok: false, progress: prog, reason: "valid but not the scheduled solution" };
}

export function hint(p: QuiltPuzzle, sol: QuiltSolution, state: QuiltState | undefined): Hint | null {
  // before the first move the shell has no state yet: hint from the empty board
  if (state === undefined) state = [];
  if (!wellFormed(p, state)) return null;
  const wrong = state.find((r) => !sol.some((s) => sameRect(s, r)));
  if (wrong) return { target: wrong, text: "This rectangle does not belong. Tap it to remove." };
  const d = nextDeduction(p, state);
  if (d) return { target: d.rect, text: `Only one rectangle fits the ${p.clues[d.clue][1]}.` };
  const missing = sol.find((s) => !state.some((r) => sameRect(r, s)));
  return missing ? { target: missing, text: "Try a rectangle here." } : null;
}

const logic: GameLogic<QuiltPuzzle, QuiltSolution, QuiltState> = {
  id: "quilt",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
