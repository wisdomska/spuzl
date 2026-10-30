/**
 * Shuffle: a sliding tile puzzle. The picture is a seeded geometric artwork; the board is scrambled by
 * a random walk of legal slides from the solved picture, so it is always solvable. Par is the length
 * of the best route the solver finds (optimal on 3 × 3, a strong weighted search on bigger boards).
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export type ArtShape =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; rot?: number }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string }
  | { t: "poly"; pts: number[]; fill: string };
export interface Art {
  bg: string;
  shapes: ArtShape[];
}
export interface ShufflePuzzle {
  size: number;
  /** tile id at each board position, row-major; tile id size*size-1 is the gap */
  tiles: number[];
  art: Art;
  par: number;
}
export interface ShuffleSolution {
  /** a route of tile ids that solves the scramble in `par` slides */
  moves: number[];
}
export interface ShuffleState {
  /** tile ids slid into the gap, in order */
  moves: number[];
}

interface Spec {
  size: number;
  walk: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { size: 3, walk: 24 },
  medium: { size: 3, walk: 60 },
  hard: { size: 4, walk: 40 },
  expert: { size: 4, walk: 70 },
  mega: { size: 5, walk: 70 },
};

export const gapOf = (size: number) => size * size - 1;
export const solved = (tiles: number[]) => tiles.every((t, i) => t === i);

/** Slides tile `id` into the gap. Returns the new board or null when the tile is not next to the gap. */
export function slide(size: number, tiles: number[], id: number): number[] | null {
  const g = tiles.indexOf(gapOf(size));
  const i = tiles.indexOf(id);
  if (i < 0 || id === gapOf(size)) return null;
  const gr = Math.floor(g / size), gc = g % size, r = Math.floor(i / size), c = i % size;
  if (Math.abs(gr - r) + Math.abs(gc - c) !== 1) return null;
  const out = tiles.slice();
  out[g] = id;
  out[i] = gapOf(size);
  return out;
}

/** Tiles between the gap and position i (same row or column), nearest the gap first. */
export function lineToGap(size: number, tiles: number[], i: number): number[] {
  const g = tiles.indexOf(gapOf(size));
  const gr = Math.floor(g / size), gc = g % size, r = Math.floor(i / size), c = i % size;
  if (i === g || (gr !== r && gc !== c)) return [];
  const out: number[] = [];
  const dr = Math.sign(r - gr), dc = Math.sign(c - gc);
  for (let y = gr + dr, x = gc + dc; ; y += dr, x += dc) {
    out.push(tiles[y * size + x]);
    if (y === r && x === c) break;
  }
  return out;
}

/** Neighbours of the gap as tile ids. */
export function movable(size: number, tiles: number[]): number[] {
  const g = tiles.indexOf(gapOf(size));
  const r = Math.floor(g / size), c = g % size;
  const out: number[] = [];
  for (const [y, x] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) if (y >= 0 && x >= 0 && y < size && x < size) out.push(tiles[y * size + x]);
  return out;
}

/** Replays a move log from the puzzle's start. */
export function replay(p: ShufflePuzzle, moves: number[]): { tiles: number[]; bad: number } {
  let tiles = p.tiles.slice();
  for (let k = 0; k < moves.length; k++) {
    const next = Number.isInteger(moves[k]) ? slide(p.size, tiles, moves[k]) : null;
    if (!next) return { tiles, bad: k };
    tiles = next;
  }
  return { tiles, bad: -1 };
}

/* ---------------- Solver ---------------- */

function heuristic(size: number, tiles: number[]): number {
  let h = 0;
  const gap = gapOf(size);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t === gap) continue;
    h += Math.abs(Math.floor(t / size) - Math.floor(i / size)) + Math.abs((t % size) - (i % size));
  }
  // linear conflicts in rows and columns
  for (let line = 0; line < size; line++) {
    for (let a = 0; a < size; a++) {
      for (let b = a + 1; b < size; b++) {
        const ra = tiles[line * size + a], rb = tiles[line * size + b];
        if (ra !== gap && rb !== gap && Math.floor(ra / size) === line && Math.floor(rb / size) === line && ra > rb) h += 2;
        const ca = tiles[a * size + line], cb = tiles[b * size + line];
        if (ca !== gap && cb !== gap && ca % size === line && cb % size === line && ca > cb) h += 2;
      }
    }
  }
  return h;
}

/** Binary heap keyed by f. */
class Heap<T> {
  private a: [number, T][] = [];
  get size() {
    return this.a.length;
  }
  push(f: number, v: T) {
    const a = this.a;
    a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

/**
 * (Weighted) A*. Weight 1 with this admissible heuristic is optimal. Returns the tile ids to slide,
 * or null if the node budget runs out.
 */
export function solve(size: number, start: number[], weight = size <= 3 ? 1 : 2.2, budget = 250_000): number[] | null {
  if (solved(start)) return [];
  const key = (t: number[]) => t.join(",");
  const parent = new Map<string, [string, number] | null>();
  const gScore = new Map<string, number>();
  const heap = new Heap<[number[], number]>();
  const k0 = key(start);
  parent.set(k0, null);
  gScore.set(k0, 0);
  heap.push(heuristic(size, start) * weight, [start, 0]);
  let nodes = 0;
  while (heap.size && nodes++ < budget) {
    const [tiles, g] = heap.pop();
    const k = key(tiles);
    if (g > gScore.get(k)!) continue;
    if (solved(tiles)) {
      const path: number[] = [];
      let cur: string = k;
      for (let link = parent.get(cur); link; link = parent.get(cur)) {
        path.push(link[1]);
        cur = link[0];
      }
      return path.reverse();
    }
    for (const id of movable(size, tiles)) {
      const next = slide(size, tiles, id)!;
      const nk = key(next);
      const ng = g + 1;
      if (ng >= (gScore.get(nk) ?? Infinity)) continue;
      gScore.set(nk, ng);
      parent.set(nk, [k, id]);
      heap.push(ng + heuristic(size, next) * weight, [next, ng]);
    }
  }
  return null;
}

/* ---------------- Art ---------------- */

/** Palettes for the artwork (illustration colours, not UI tokens). */
const PALETTES = [
  ["#FF8A3D", "#FFD23F", "#2FD3E0", "#8B7CFF", "#20233A", "#F4F5FB"],
  ["#3DDC84", "#FFC93C", "#FF6B6B", "#4D8BFF", "#171929", "#FFE7C2"],
  ["#F27ADB", "#8B7CFF", "#FFD23F", "#2FD3E0", "#1A1C30", "#FFF4E0"],
  ["#FF5A5F", "#FF8A3D", "#FFD23F", "#3DDC84", "#14323A", "#F4F5FB"],
];

/** A landscape-ish geometric picture: banded sky, sun, layered hills, stripes and dots. Every region looks different. */
export function makeArt(rng: Rng): Art {
  const pal = rng.pick(PALETTES).slice();
  const [a, b, c, d, dark, light] = pal;
  const shapes: ArtShape[] = [];
  // sky bands
  const bands = rng.int(3, 5);
  const sky = [d, c, light, b, a];
  for (let k = 0; k < bands; k++) shapes.push({ t: "rect", x: 0, y: (k * 60) / bands, w: 100, h: 60 / bands + 0.5, fill: sky[k % sky.length] });
  // sun with rings
  const sx = rng.int(18, 82), sy = rng.int(16, 34);
  shapes.push({ t: "circle", cx: sx, cy: sy, r: 16, fill: light });
  shapes.push({ t: "circle", cx: sx, cy: sy, r: 11, fill: b });
  shapes.push({ t: "circle", cx: sx, cy: sy, r: 5, fill: a });
  // hills
  const hills = [a, c, d];
  for (let k = 0; k < 3; k++) {
    const base = 52 + k * 14;
    const peak = rng.int(-10, 110);
    const w = rng.int(45, 75);
    shapes.push({ t: "poly", pts: [peak - w, 100, peak, base - 18, peak + w, 100], fill: hills[k] });
  }
  // ground stripes
  for (let k = 0; k < 4; k++) shapes.push({ t: "rect", x: -10, y: 86 + k * 4, w: 120, h: 2, fill: k % 2 ? light : dark });
  // confetti dots
  for (let k = 0; k < 9; k++) shapes.push({ t: "circle", cx: rng.int(4, 96), cy: rng.int(4, 96), r: rng.int(2, 4), fill: rng.pick([a, b, c, d, light]) });
  // a rotated diamond
  shapes.push({ t: "rect", x: rng.int(10, 70), y: rng.int(40, 60), w: 14, h: 14, fill: light, rot: 45 });
  return { bg: dark, shapes };
}

/* ---------------- Generator ---------------- */

function scramble(size: number, walk: number, rng: Rng): number[] {
  let tiles = Array.from({ length: size * size }, (_, i) => i);
  let prev = -1;
  for (let k = 0; k < walk; k++) {
    const opts = movable(size, tiles).filter((id) => id !== prev);
    const id = rng.pick(opts);
    tiles = slide(size, tiles, id)!;
    prev = id;
  }
  return tiles;
}

/** 0..100 from board size and par. */
export function grade(p: ShufflePuzzle): number {
  return Math.max(0, Math.min(100, Math.round((p.size - 3) * 22 + (p.par / (p.size * p.size * 3)) * 45)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<ShufflePuzzle, ShuffleSolution> {
  const { size, walk } = SPEC[difficulty];
  const art = makeArt(rng);
  for (let attempt = 0; attempt < 50; attempt++) {
    const tiles = scramble(size, walk, rng);
    // most tiles out of place, gap anywhere
    const wrong = tiles.filter((t, i) => t !== i && t !== gapOf(size)).length;
    if (wrong < Math.ceil((size * size - 1) * 0.6)) continue;
    const moves = solve(size, tiles);
    if (!moves) continue;
    const puzzle: ShufflePuzzle = { size, tiles, art, par: moves.length };
    return { puzzle, solution: { moves }, grade: grade(puzzle) };
  }
  throw new Error(`shuffle: could not generate a ${difficulty} puzzle`);
}

/* ---------------- Verification ---------------- */

const wellFormed = (s: unknown): s is ShuffleState => !!s && typeof s === "object" && Array.isArray((s as ShuffleState).moves) && (s as ShuffleState).moves.length < 5000;

/** Tiles home / tiles. Counting positions only, never the route. */
export function progress(p: ShufflePuzzle, _sol: ShuffleSolution, state: ShuffleState): number {
  if (!wellFormed(state)) return 0;
  const { tiles } = replay(p, state.moves);
  const gap = gapOf(p.size);
  return tiles.filter((t, i) => t === i && t !== gap).length / gap;
}

export function verify(p: ShufflePuzzle, sol: ShuffleSolution, state: ShuffleState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const r = replay(p, state.moves);
  if (r.bad >= 0) return { ok: false, progress: 0, reason: `illegal slide at ${r.bad + 1}` };
  if (!solved(r.tiles)) return { ok: false, progress: progress(p, sol, state), reason: "picture not whole" };
  return { ok: true, progress: 1 };
}

export function hint(p: ShufflePuzzle, sol: ShuffleSolution, state: ShuffleState): Hint | null {
  if (!wellFormed(state)) return null;
  const r = replay(p, state.moves);
  if (r.bad >= 0 || solved(r.tiles)) return null;
  // untouched board: the stored route is ready
  const route = state.moves.length === 0 ? sol.moves : solve(p.size, r.tiles);
  if (route && route.length) return { target: route[0], text: `Slide tile ${route[0] + 1} into the gap.` };
  // search ran out of budget: walking back the last slide is always safe
  const back = state.moves[state.moves.length - 1];
  return { target: back, text: `Slide tile ${back + 1} back.` };
}

const logic: GameLogic<ShufflePuzzle, ShuffleSolution, ShuffleState> = {
  id: "shuffle",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
