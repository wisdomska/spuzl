/**
 * Snug: fit every block exactly into the outline. Blocks rotate (no flipping). The generator carves
 * an outline into polyominoes, so a fit always exists; any exact cover is accepted (the catalogue does
 * not require a unique answer), checked by the exact-cover rules in verify().
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

/** [row, col] */
export type Cell = [number, number];
export interface SnugPuzzle {
  rows: number;
  cols: number;
  /** 1 inside the outline, 0 outside, row-major */
  outline: number[];
  /** blocks in their tray orientation, normalised to start at 0,0 */
  pieces: Cell[][];
}
/** origin of the rotated block's bounding box, and quarter turns clockwise from the tray orientation */
export interface Placement {
  r: number;
  c: number;
  rot: number;
}
export type SnugSolution = Placement[];
/** one entry per block; null while in the tray */
export type SnugState = (Placement | null)[];

interface Spec {
  rows: number;
  cols: number;
  notches: [number, number];
  sizes: [number, number];
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { rows: 4, cols: 4, notches: [0, 1], sizes: [3, 4] },
  medium: { rows: 5, cols: 5, notches: [1, 3], sizes: [3, 5] },
  hard: { rows: 5, cols: 6, notches: [2, 4], sizes: [4, 5] },
  expert: { rows: 6, cols: 6, notches: [2, 4], sizes: [4, 5] },
  mega: { rows: 7, cols: 7, notches: [3, 5], sizes: [4, 6] },
};

export function normalise(cells: Cell[]): Cell[] {
  const mr = Math.min(...cells.map((x) => x[0])), mc = Math.min(...cells.map((x) => x[1]));
  return cells.map(([r, c]) => [r - mr, c - mc] as Cell).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Quarter turns clockwise: (r, c) → (c, -r), then normalised. */
export function rotate(cells: Cell[], times: number): Cell[] {
  let out = cells;
  for (let k = 0; k < ((times % 4) + 4) % 4; k++) out = normalise(out.map(([r, c]) => [c, -r] as Cell));
  return normalise(out);
}

export const shapeKey = (cells: Cell[]) => normalise(cells).map((x) => x.join(".")).join("|");

/** Board cells a placed block covers (may fall outside the board). */
export function cellsOf(p: SnugPuzzle, k: number, pl: Placement): Cell[] {
  return rotate(p.pieces[k], pl.rot).map(([r, c]) => [r + pl.r, c + pl.c] as Cell);
}

export const inside = (p: SnugPuzzle, [r, c]: Cell) => r >= 0 && c >= 0 && r < p.rows && c < p.cols && p.outline[r * p.cols + c] === 1;

export type FitBreak = "outside" | "overlap";
export const FIT_COPY: Record<FitBreak, string> = {
  outside: "That block hangs outside the outline.",
  overlap: "Blocks cannot overlap.",
};

/** Can block k sit at this placement, given the other placements? */
export function fitBreak(p: SnugPuzzle, state: SnugState, k: number, pl: Placement): FitBreak | null {
  const cells = cellsOf(p, k, pl);
  if (cells.some((x) => !inside(p, x))) return "outside";
  const taken = occupancy(p, state, k);
  if (cells.some(([r, c]) => taken[r * p.cols + c] >= 0)) return "overlap";
  return null;
}

/** Block index per board cell (-1 free), skipping block `skip`. */
export function occupancy(p: SnugPuzzle, state: SnugState, skip = -1): number[] {
  const out = new Array<number>(p.rows * p.cols).fill(-1);
  state.forEach((pl, k) => {
    if (!pl || k === skip) return;
    for (const [r, c] of cellsOf(p, k, pl)) if (r >= 0 && c >= 0 && r < p.rows && c < p.cols) out[r * p.cols + c] = k;
  });
  return out;
}

/* ---------------- Exact cover solver ---------------- */

/** Search nodes per call; keeps hints on badly blocked boards from stalling. */
const NODE_BUDGET = 400_000;

interface Option {
  k: number;
  pl: Placement;
  cells: number[];
}

function options(p: SnugPuzzle): Option[][] {
  return p.pieces.map((piece, k) => {
    const seen = new Set<string>();
    const out: Option[] = [];
    for (let rot = 0; rot < 4; rot++) {
      const shape = rotate(piece, rot);
      const sk = shapeKey(shape);
      if (seen.has(sk)) continue;
      seen.add(sk);
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        const cells = shape.map(([y, x]) => [y + r, x + c] as Cell);
        if (cells.every((x) => inside(p, x))) out.push({ k, pl: { r, c, rot }, cells: cells.map(([y, x]) => y * p.cols + x) });
      }
    }
    return out;
  });
}

/**
 * Counts exact covers (up to `limit`), keeping any fixed placements. Identical blocks are treated as
 * interchangeable so swapping two equal shapes does not count as a new answer.
 */
function search(p: SnugPuzzle, limit: number, fixed: SnugState = [], found?: (s: Placement[]) => void): number {
  const opts = options(p);
  const n = p.rows * p.cols;
  const covered = new Int16Array(n).fill(-1);
  const used = new Uint8Array(p.pieces.length);
  const chosen: Placement[] = new Array(p.pieces.length);
  for (let k = 0; k < fixed.length; k++) {
    const pl = fixed[k];
    if (!pl) continue;
    const cells = cellsOf(p, k, pl);
    for (const x of cells) {
      if (!inside(p, x) || covered[x[0] * p.cols + x[1]] >= 0) return 0;
      covered[x[0] * p.cols + x[1]] = k;
    }
    used[k] = 1;
    chosen[k] = pl;
  }
  const canon = p.pieces.map((x) => [0, 1, 2, 3].map((t) => shapeKey(rotate(x, t))).sort()[0]);
  let count = 0;
  let nodes = 0;
  const rec = () => {
    if (count >= limit || ++nodes > NODE_BUDGET) return;
    // the first free outline cell; some block must cover it
    let i = 0;
    while (i < n && (p.outline[i] !== 1 || covered[i] >= 0)) i++;
    if (i === n) {
      count++;
      found?.(chosen.slice());
      return;
    }
    const triedShapes = new Set<string>();
    for (let k = 0; k < p.pieces.length; k++) {
      if (used[k] || triedShapes.has(canon[k])) continue;
      triedShapes.add(canon[k]);
      for (const o of opts[k]) {
        if (!o.cells.includes(i) || o.cells.some((x) => covered[x] >= 0)) continue;
        for (const x of o.cells) covered[x] = k;
        used[k] = 1;
        chosen[k] = o.pl;
        rec();
        used[k] = 0;
        for (const x of o.cells) covered[x] = -1;
        if (count >= limit) return;
      }
    }
  };
  rec();
  return count;
}

export function countSolutions(p: SnugPuzzle, limit = 2): number {
  return search(p, limit);
}

/** One full fit that keeps the given placements, or null. */
export function complete(p: SnugPuzzle, fixed: SnugState = []): Placement[] | null {
  let out: Placement[] | null = null;
  search(p, 1, fixed, (s) => (out = s));
  return out;
}

/* ---------------- Generator ---------------- */

function carveOutline(spec: Spec, rng: Rng): number[] {
  const { rows, cols } = spec;
  const outline = new Array<number>(rows * cols).fill(1);
  const notches = rng.int(spec.notches[0], spec.notches[1]);
  const border: number[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) border.push(r * cols + c);
  rng.shuffle(border);
  let made = 0;
  for (const i of border) {
    if (made >= notches) break;
    outline[i] = 0;
    if (!connected(rows, cols, outline)) outline[i] = 1;
    else made++;
  }
  return outline;
}

function connected(rows: number, cols: number, mask: number[], value = 1): boolean {
  const cells = mask.flatMap((v, i) => (v === value ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / cols), c = i % cols;
    for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const j = y * cols + x;
      if (y >= 0 && x >= 0 && y < rows && x < cols && mask[j] === value && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/** Grows blocks one at a time from the first free cell. Returns null when a leftover pocket is too small. */
function partition(spec: Spec, outline: number[], rng: Rng): Cell[][] | null {
  const { rows, cols } = spec;
  const owner: number[] = outline.map((v) => (v === 1 ? -1 : -2));
  const pieces: Cell[][] = [];
  for (let start = 0; start < owner.length; start++) {
    if (owner[start] !== -1) continue;
    const want = rng.int(spec.sizes[0], spec.sizes[1]);
    const cells = [start];
    owner[start] = pieces.length;
    while (cells.length < want) {
      const frontier: number[] = [];
      for (const i of cells) {
        const r = Math.floor(i / cols), c = i % cols;
        for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          const j = y * cols + x;
          if (y >= 0 && x >= 0 && y < rows && x < cols && owner[j] === -1 && !frontier.includes(j)) frontier.push(j);
        }
      }
      if (!frontier.length) break;
      const j = rng.pick(frontier);
      owner[j] = pieces.length;
      cells.push(j);
    }
    if (cells.length < Math.min(3, spec.sizes[0])) return null;
    // leftover free cells must stay in pockets large enough for a block
    if (!pocketsOk(rows, cols, owner, spec.sizes[0])) return null;
    pieces.push(cells.map((i) => [Math.floor(i / cols), i % cols] as Cell));
  }
  return pieces;
}

function pocketsOk(rows: number, cols: number, owner: number[], min: number): boolean {
  const seen = new Uint8Array(owner.length);
  for (let s = 0; s < owner.length; s++) {
    if (owner[s] !== -1 || seen[s]) continue;
    let size = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const r = Math.floor(i / cols), c = i % cols;
      for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const j = y * cols + x;
        if (y >= 0 && x >= 0 && y < rows && x < cols && owner[j] === -1 && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (size < min) return false;
  }
  return true;
}

/** 0..100: more blocks and fewer alternative fits are harder. */
export function grade(p: SnugPuzzle): number {
  const fits = countSolutions(p, 40);
  const scarcity = 1 - Math.log2(fits) / Math.log2(40);
  return Math.max(0, Math.min(100, Math.round(p.pieces.length * 6 + scarcity * 40)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<SnugPuzzle, SnugSolution> {
  const spec = SPEC[difficulty];
  for (let attempt = 0; attempt < 500; attempt++) {
    const outline = carveOutline(spec, rng);
    const parts = partition(spec, outline, rng);
    if (!parts) continue;
    // no 1×n bars of length 2; keep shapes interesting: at most one straight block
    const straight = parts.filter((x) => new Set(x.map((y) => y[0])).size === 1 || new Set(x.map((y) => y[1])).size === 1).length;
    if (straight > 1) continue;
    const pieces: Cell[][] = [];
    const solution: Placement[] = [];
    for (const part of parts) {
      const turn = rng.int(0, 3);
      const tray = rotate(normalise(part), turn);
      const back = (4 - turn) % 4;
      const mr = Math.min(...part.map((x) => x[0])), mc = Math.min(...part.map((x) => x[1]));
      pieces.push(tray);
      solution.push({ r: mr, c: mc, rot: back });
    }
    // shuffle tray order, keeping solution aligned
    const order = rng.shuffle(pieces.map((_, i) => i));
    const puzzle: SnugPuzzle = { rows: spec.rows, cols: spec.cols, outline, pieces: order.map((i) => pieces[i]) };
    const sol = order.map((i) => solution[i]);
    return { puzzle, solution: sol, grade: grade(puzzle) };
  }
  throw new Error(`snug: could not generate a ${difficulty} puzzle`);
}

/* ---------------- Verification ---------------- */

function wellFormed(p: SnugPuzzle, state: unknown): state is SnugState {
  if (!Array.isArray(state) || state.length !== p.pieces.length) return false;
  return state.every(
    (pl) => pl === null || (typeof pl === "object" && [pl.r, pl.c, pl.rot].every((v) => Number.isInteger(v)) && pl.rot >= 0 && pl.rot < 4),
  );
}

const outlineSize = (p: SnugPuzzle) => p.outline.filter((v) => v === 1).length;

/** Share of the outline covered by blocks that sit legally. Says nothing about where blocks go. */
export function progress(p: SnugPuzzle, _sol: SnugSolution, state: SnugState): number {
  if (!wellFormed(p, state)) return 0;
  let covered = 0;
  state.forEach((pl, k) => {
    if (pl && !fitBreak(p, state, k, pl)) covered += p.pieces[k].length;
  });
  return Math.min(1, covered / outlineSize(p));
}

export function verify(p: SnugPuzzle, sol: SnugSolution, state: SnugState): VerifyResult {
  if (!wellFormed(p, state)) return { ok: false, progress: 0, reason: "malformed state" };
  const prog = progress(p, sol, state);
  if (state.some((pl) => pl === null)) return { ok: false, progress: prog, reason: "blocks left in the tray" };
  for (let k = 0; k < state.length; k++) {
    const b = fitBreak(p, state, k, state[k]!);
    if (b) return { ok: false, progress: prog, reason: b };
  }
  const occ = occupancy(p, state);
  const exact = p.outline.every((v, i) => (v === 1) === (occ[i] >= 0));
  return exact ? { ok: true, progress: 1 } : { ok: false, progress: prog, reason: "outline not covered" };
}

export function hint(p: SnugPuzzle, sol: SnugSolution, state: SnugState): Hint | null {
  if (!wellFormed(p, state)) return null;
  // blocks that are illegal right now come first
  for (let k = 0; k < state.length; k++) {
    const pl = state[k];
    if (pl && fitBreak(p, state, k, pl)) return { target: { piece: k }, text: "This block does not fit there." };
  }
  let fit = complete(p, state);
  if (!fit) {
    // find a placed block whose removal unlocks a full fit, preferring blocks away from the stored answer
    const placed = state.map((pl, k) => [pl, k] as const).filter(([pl]) => pl);
    placed.sort(([a, ka], [b, kb]) => Number(same(b!, sol[kb])) - Number(same(a!, sol[ka])));
    for (const [, k] of placed) {
      const without = state.slice();
      without[k] = null;
      if (complete(p, without)) return { target: { piece: k }, text: "This block is in the way. Move it." };
    }
    const k = placed[0][1];
    return { target: { piece: k }, text: "This block is in the way. Move it." };
  }
  if (state.every((pl) => pl)) return null;
  fit = fit as Placement[];
  const k = state.findIndex((pl) => !pl);
  return { target: { piece: k, place: fit[k] }, text: "This block fits here." };
}
const same = (a: Placement, b: Placement) => a.r === b.r && a.c === b.c && a.rot === b.rot;

const logic: GameLogic<SnugPuzzle, SnugSolution, SnugState> = {
  id: "snug",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;
