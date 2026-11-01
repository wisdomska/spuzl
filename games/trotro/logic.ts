/**
 * Trotro Jam: a sliding-vehicles puzzle on a 6 × 6 lorry station. Every vehicle slides along its own axis
 * (cars are 2 long, trucks 3 long); slide the others out of the way until the trotro (2 long, horizontal, on
 * the exit row) reaches the exit on the right edge. A slide of any distance is one move.
 *
 * Generation: a random legal layout, then a breadth-first search of every position reachable from it. A
 * second, multi-source BFS from the solved positions in that space gives the true minimum moves for each
 * one, and the puzzle is a position whose minimum falls in the difficulty's range (the hardest one for hard
 * and up). The server verifies by replaying the move log, slide by slide.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { TROTRO_COPY } from "@/lib/copy/trotro";

export const SIZE = 6;
/** The exit row (0-based): the trotro sits on it and leaves through the right edge. */
export const EXIT_ROW = 2;
/** The trotro's column when it is at the exit gate. */
export const EXIT_COL = SIZE - 2;

export type Axis = "h" | "v";
export interface Vehicle {
  /** 2 (trotro or car) or 3 (truck) */
  len: 2 | 3;
  axis: Axis;
  /** fixed row for "h", fixed column for "v" */
  line: number;
}
export interface TrotroPuzzle {
  size: number;
  exitRow: number;
  /** vehicles[0] is the trotro */
  vehicles: Vehicle[];
  /** starting offset along each vehicle's axis (column for "h", row for "v") */
  start: number[];
  /** fewest moves that free the trotro (shown to players) */
  par: number;
}
/** One move: vehicle index and signed slide distance (positive is right or down). */
export type Move = [number, number];
export interface TrotroSolution {
  moves: Move[];
}
export interface TrotroState {
  moves: Move[];
}

interface Spec {
  /** vehicles besides the trotro */
  others: [number, number];
  /** chance a vehicle is a truck */
  trucks: number;
  /** allowed minimum-move range */
  range: [number, number];
  /** take the hardest position in the space (true) or a random one in range */
  hardest: boolean;
  /** positions searched per layout; deep puzzles live in tight lots with small spaces, so hard caps low */
  cap: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { others: [6, 8], trucks: 0.25, range: [6, 10], hardest: false, cap: 12000 },
  medium: { others: [8, 10], trucks: 0.3, range: [11, 16], hardest: false, cap: 8000 },
  hard: { others: [9, 12], trucks: 0.3, range: [20, 60], hardest: true, cap: 6000 },
  expert: { others: [10, 12], trucks: 0.3, range: [21, 60], hardest: true, cap: 6000 },
  mega: { others: [10, 12], trucks: 0.35, range: [22, 60], hardest: true, cap: 6000 },
};
/** Positions searched per layout before giving up on it (keeps generation and hints fast). */
const SPACE_CAP = 40000;
const MAX_MOVES = 1000;

/* ---------------- Board mechanics ---------------- */

/** Cell indexes (row * size + col) the vehicle covers at offset `at`. */
export function cellsOf(size: number, v: Vehicle, at: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < v.len; k++) out.push(v.axis === "h" ? v.line * size + at + k : (at + k) * size + v.line);
  return out;
}

/** Occupancy grid: vehicle index per cell, -1 when empty. */
export function occupancy(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[]): number[] {
  const g = new Array<number>(p.size * p.size).fill(-1);
  p.vehicles.forEach((v, i) => {
    for (const c of cellsOf(p.size, v, pos[i])) g[c] = i;
  });
  return g;
}

/** How far vehicle `i` can slide: [most negative, most positive] distance. */
export function room(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], i: number, occ = occupancy(p, pos)): [number, number] {
  const v = p.vehicles[i];
  const at = pos[i];
  const cell = (k: number) => (v.axis === "h" ? v.line * p.size + k : k * p.size + v.line);
  let lo = 0;
  while (at + lo - 1 >= 0 && occ[cell(at + lo - 1)] === -1) lo--;
  let hi = 0;
  while (at + v.len + hi < p.size && occ[cell(at + v.len + hi)] === -1) hi++;
  return [lo, hi];
}

/** Applies a move, or returns null when it is not a legal slide. */
export function applyMove(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], m: Move): number[] | null {
  const [i, d] = m;
  if (!Number.isInteger(i) || !Number.isInteger(d) || i < 0 || i >= p.vehicles.length || d === 0) return null;
  const [lo, hi] = room(p, pos, i);
  if (d < lo || d > hi) return null;
  const next = pos.slice();
  next[i] += d;
  return next;
}

export const isSolved = (pos: number[]) => pos[0] === EXIT_COL;

/** Replays a move log from the start. Returns null at the first illegal slide. */
export function replay(p: TrotroPuzzle, moves: Move[]): number[] | null {
  let pos: number[] | null = p.start.slice();
  for (const m of moves) {
    pos = applyMove(p, pos, m);
    if (!pos) return null;
  }
  return pos;
}

/** Every legal move from `pos`, in a fixed order (vehicle, then distance). */
export function legalMoves(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[]): Move[] {
  const occ = occupancy(p, pos);
  const out: Move[] = [];
  for (let i = 0; i < p.vehicles.length; i++) {
    const [lo, hi] = room(p, pos, i, occ);
    for (let d = lo; d <= hi; d++) if (d) out.push([i, d]);
  }
  return out;
}

/** Positions as one number: each offset is 0..4, so base 5 stays exact for up to 22 vehicles. */
const keyOf = (pos: number[]) => {
  let k = 0;
  for (let i = pos.length - 1; i >= 0; i--) k = k * 5 + pos[i];
  return k;
};

/* ---------------- Solver ---------------- */

/**
 * Fewest-move route from `pos` to the exit (breadth-first, a slide of any length is one move), or null when
 * the trotro cannot get out or the search passes `cap` positions.
 */
export function solve(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], cap = SPACE_CAP * 3): Move[] | null {
  if (isSolved(pos)) return [];
  const start = keyOf(pos);
  const parent = new Map<number, [number, Move] | null>([[start, null]]);
  const states = new Map<number, number[]>([[start, pos]]);
  let frontier = [start];
  while (frontier.length) {
    const next: number[] = [];
    for (const k of frontier) {
      const cur = states.get(k)!;
      for (const m of legalMoves(p, cur)) {
        const n = cur.slice();
        n[m[0]] += m[1];
        const nk = keyOf(n);
        if (parent.has(nk)) continue;
        parent.set(nk, [k, m]);
        if (isSolved(n)) {
          const path: Move[] = [];
          for (let at = nk; parent.get(at); at = parent.get(at)![0]) path.unshift(parent.get(at)![1]);
          return path;
        }
        if (parent.size > cap) return null;
        states.set(nk, n);
        next.push(nk);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * The whole position space reachable from `pos`, with each position's minimum moves to the exit
 * (Infinity when the trotro can never leave). Moves are reversible, so one BFS from every solved position
 * gives exact distances. Null when the space passes `cap`.
 */
export function distances(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], cap = SPACE_CAP) {
  // Hot loop of the generator: states are base-5 keys, neighbours are key arithmetic, nothing is allocated
  // per move. `edges` is a flat neighbour list with `from` offsets.
  const { size, vehicles } = p;
  const n = vehicles.length;
  const pow = Array.from({ length: n }, (_, i) => 5 ** i);
  const lineCell = vehicles.map((v) => (k: number) => (v.axis === "h" ? v.line * size + k : k * size + v.line));
  const occ = new Int8Array(size * size);
  const cur = new Array<number>(n);
  const keys: number[] = [keyOf(pos)];
  const index = new Map<number, number>([[keys[0], 0]]);
  const edges: number[] = [];
  const from: number[] = [];
  for (let s = 0; s < keys.length; s++) {
    from.push(edges.length);
    let k = keys[s];
    for (let i = 0; i < n; i++) {
      cur[i] = k % 5;
      k = (k - cur[i]) / 5;
    }
    occ.fill(-1);
    for (let i = 0; i < n; i++) for (let c = 0; c < vehicles[i].len; c++) occ[lineCell[i](cur[i] + c)] = i;
    for (let i = 0; i < n; i++) {
      const at = cur[i],
        len = vehicles[i].len,
        cell = lineCell[i];
      for (let dir = -1; dir <= 1; dir += 2)
        for (let d = dir; ; d += dir) {
          const edge = dir < 0 ? at + d : at + len - 1 + d;
          if (edge < 0 || edge >= size || occ[cell(edge)] !== -1) break;
          const nk = keys[s] + d * pow[i];
          let j = index.get(nk);
          if (j === undefined) {
            if (keys.length >= cap) return null;
            j = keys.length;
            index.set(nk, j);
            keys.push(nk);
          }
          edges.push(j);
        }
    }
  }
  from.push(edges.length);
  const dist = new Array<number>(keys.length).fill(Infinity);
  let frontier: number[] = [];
  keys.forEach((k, i) => {
    if (k % 5 === EXIT_COL) {
      dist[i] = 0;
      frontier.push(i);
    }
  });
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const s of frontier)
      for (let e = from[s]; e < from[s + 1]; e++)
        if (dist[edges[e]] === Infinity) {
          dist[edges[e]] = d;
          next.push(edges[e]);
        }
    frontier = next;
  }
  const at = (i: number) => {
    const out: number[] = [];
    let k = keys[i];
    for (let v = 0; v < n; v++) {
      out.push(k % 5);
      k = (k - (k % 5)) / 5;
    }
    return out;
  };
  return { size: keys.length, dist, at };
}

/* ---------------- Generator and grader ---------------- */

/** A random legal layout: the trotro on the exit row, then cars and trucks wherever they fit. */
function layout(rng: Rng, others: number, trucks: number): { vehicles: Vehicle[]; pos: number[] } {
  const vehicles: Vehicle[] = [{ len: 2, axis: "h", line: EXIT_ROW }];
  const pos = [rng.int(0, EXIT_COL - 2)];
  addVehicles(rng, vehicles, pos, others, trucks);
  return { vehicles, pos };
}

/** Adds up to `count` random cars and trucks wherever they fit (never across the exit row). */
function addVehicles(rng: Rng, vehicles: Vehicle[], pos: number[], count: number, trucks: number): void {
  let occ = occupancy({ size: SIZE, vehicles }, pos);
  for (let tries = 0, added = 0; added < count && tries < 400; tries++) {
    const len: 2 | 3 = rng.chance(trucks) ? 3 : 2;
    const axis: Axis = rng.chance(0.5) ? "h" : "v";
    const line = rng.int(0, SIZE - 1);
    // Nothing else lies across the exit row: it could never move out of the trotro's way.
    if (axis === "h" && line === EXIT_ROW) continue;
    const at = rng.int(0, SIZE - len);
    const v: Vehicle = { len, axis, line };
    if (cellsOf(SIZE, v, at).some((c) => occ[c] !== -1)) continue;
    vehicles.push(v);
    pos.push(at);
    occ = occupancy({ size: SIZE, vehicles }, pos);
    added++;
  }
}

type Found = { vehicles: Vehicle[]; pos: number[]; d: number };

/** The hardest solvable position in a layout's space, or null. */
function hardestOf(vehicles: Vehicle[], pos: number[], cap: number): Found | null {
  const sp = distances({ size: SIZE, vehicles }, pos, cap);
  if (!sp) return null;
  let far = -1;
  sp.dist.forEach((d, i) => {
    if (d !== Infinity && (far < 0 || d > sp.dist[far])) far = i;
  });
  return far >= 0 && sp.dist[far] > 0 ? { vehicles, pos: sp.at(far), d: sp.dist[far] } : null;
}

/**
 * Hill climb for deep lots: take the hardest position of a random layout, then keep swapping one vehicle
 * for a random new one (starting from that hardest position) while the depth does not drop, restarting
 * when it stalls. Random layouts alone rarely reach 20+ moves; this gets there in a few hundred searches.
 */
function climb(rng: Rng, spec: Spec): Found | null {
  const [lo, hi] = spec.range;
  let cur: Found | null = null;
  let best: Found | null = null;
  let stall = 0;
  for (let it = 0; it < 2500; it++) {
    let vehicles: Vehicle[], pos: number[];
    if (!cur || stall > 60) {
      ({ vehicles, pos } = layout(rng, rng.int(spec.others[0], spec.others[1]), spec.trucks));
      cur = null;
      stall = 0;
    } else {
      vehicles = cur.vehicles.slice();
      pos = cur.pos.slice();
      const others = vehicles.length - 1;
      const drop = others > spec.others[0] && (others >= spec.others[1] || rng.chance(0.5));
      if (drop) {
        const i = rng.int(1, vehicles.length - 1);
        vehicles.splice(i, 1);
        pos.splice(i, 1);
      }
      if (!drop || rng.chance(0.7)) addVehicles(rng, vehicles, pos, 1, spec.trucks);
    }
    stall++;
    const h = hardestOf(vehicles, pos, spec.cap);
    if (!h || h.d > hi) continue;
    if (!cur || h.d >= cur.d) {
      if (!cur || h.d > cur.d) stall = 0;
      cur = h;
    }
    if (!best || cur.d > best.d) best = cur;
    if (best.d >= lo) return best;
  }
  return best;
}

/** 0..100 from par, with a little weight on how crowded the lot is. */
export function grade(p: TrotroPuzzle): number {
  return Math.max(0, Math.min(100, Math.round(p.par * 2.6 + (p.vehicles.length - 7) * 2)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<TrotroPuzzle, TrotroSolution> {
  const spec = SPEC[difficulty];
  const [lo, hi] = spec.range;
  if (spec.hardest) {
    const c = climb(rng, spec);
    if (!c) throw new Error(`trotro: could not generate a ${difficulty} lot`);
    return finish(c.vehicles, c.pos);
  }
  // Easy and medium aim for a par drawn evenly from the range (most spaces are full of short positions).
  const want = rng.int(lo, hi);
  let best: Found | null = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    const { vehicles, pos } = layout(rng, rng.int(spec.others[0], spec.others[1]), spec.trucks);
    const sp = distances({ size: SIZE, vehicles }, pos, spec.cap);
    if (!sp) continue;
    const inRange = sp.dist.flatMap((d, i) => (d >= lo && d <= hi ? [i] : []));
    if (!inRange.length) {
      // Keep the hardest position seen so far, for the rare seed where no layout reaches the range.
      const far = sp.dist.reduce((b, d, i) => (d !== Infinity && (b < 0 || d > sp.dist[b]) ? i : b), -1);
      if (far >= 0 && sp.dist[far] > 0 && (!best || sp.dist[far] > best.d)) best = { vehicles, pos: sp.at(far), d: sp.dist[far] };
      continue;
    }
    const exact = inRange.filter((i) => sp.dist[i] === want);
    if (!exact.length && attempt < 200) continue;
    const pick = rng.pick(exact.length ? exact : inRange);
    return finish(vehicles, sp.at(pick));
  }
  if (best) return finish(best.vehicles, best.pos);
  throw new Error(`trotro: could not generate a ${difficulty} lot`);
}

function finish(vehicles: Vehicle[], pos: number[]): Generated<TrotroPuzzle, TrotroSolution> {
  const moves = solve({ size: SIZE, vehicles }, pos)!;
  const puzzle: TrotroPuzzle = { size: SIZE, exitRow: EXIT_ROW, vehicles, start: pos, par: moves.length };
  return { puzzle, solution: { moves }, grade: grade(puzzle) };
}

/* ---------------- Verification ---------------- */

function movesOf(state: unknown): Move[] | null {
  const ms = (state as TrotroState | null)?.moves;
  if (!Array.isArray(ms) || ms.length > MAX_MOVES) return null;
  if (!ms.every((m) => Array.isArray(m) && m.length === 2 && Number.isInteger(m[0]) && Number.isInteger(m[1]))) return null;
  return ms as Move[];
}

export function verify(p: TrotroPuzzle, sol: TrotroSolution, state: TrotroState): VerifyResult {
  const ms = movesOf(state);
  if (!ms) return { ok: false, progress: 0, reason: "malformed state" };
  const pos = replay(p, ms);
  if (!pos) return { ok: false, progress: 0, reason: "illegal slide" };
  if (!isSolved(pos)) return { ok: false, progress: progress(p, sol, state), reason: "trotro still parked" };
  return { ok: true, progress: 1 };
}

/** Share of the par distance covered: 1 − (moves still needed at best / par). */
export function progress(p: TrotroPuzzle, _sol: TrotroSolution, state: TrotroState): number {
  const ms = movesOf(state);
  const pos = ms && replay(p, ms);
  if (!pos) return 0;
  const left = solve(p, pos);
  if (!left) return 0;
  return Math.max(0, Math.min(1, 1 - left.length / Math.max(1, p.par)));
}

/* ---------------- Hints ---------------- */

/** "the trotro", "the blue car B", "the green truck C". */
export function vehicleName(p: Pick<TrotroPuzzle, "vehicles">, i: number): string {
  if (i === 0) return TROTRO_COPY.trotro;
  return TROTRO_COPY.vehicleName(p.vehicles[i].len, i);
}

export function directionOf(v: Vehicle, d: number): "up" | "down" | "left" | "right" {
  return v.axis === "h" ? (d > 0 ? "right" : "left") : d > 0 ? "down" : "up";
}

/** Cells a slide passes over or lands on that the vehicle did not cover before. */
function swept(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], m: Move): Set<number> {
  const v = p.vehicles[m[0]];
  const before = new Set(cellsOf(p.size, v, pos[m[0]]));
  const out = new Set<number>();
  const step = Math.sign(m[1]);
  for (let k = step; k !== m[1] + step; k += step) for (const c of cellsOf(p.size, v, pos[m[0]] + k)) if (!before.has(c)) out.add(c);
  return out;
}

/** Why a route's first move matters: the first later move that needs a cell it frees. */
export function explain(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], route: Move[]): string {
  const [first] = route;
  const v = first[0];
  const dir = directionOf(p.vehicles[v], first[1]);
  const after = pos.slice();
  after[v] += first[1];
  if (v === 0 && isSolved(after)) return TROTRO_COPY.hints.driveOut;
  const freed = new Set(cellsOf(p.size, p.vehicles[v], pos[v]).filter((c) => !cellsOf(p.size, p.vehicles[v], after[v]).includes(c)));
  let cur = after;
  for (let k = 1; k < route.length; k++) {
    const m = route[k];
    if (m[0] !== v && [...swept(p, cur, m)].some((c) => freed.has(c)))
      return TROTRO_COPY.hints.soThat(vehicleName(p, v), dir, vehicleName(p, m[0]), directionOf(p.vehicles[m[0]], m[1]), m[0] === 0);
    cur = cur.slice();
    cur[m[0]] += m[1];
  }
  return TROTRO_COPY.hints.plain(vehicleName(p, v), dir, route.length);
}

export function hint(p: TrotroPuzzle, _sol: TrotroSolution, state: TrotroState): Hint | null {
  const ms = movesOf(state);
  const pos = ms && replay(p, ms);
  if (!pos || isSolved(pos)) return null;
  const route = solve(p, pos);
  if (!route || !route.length) return null;
  return { target: { vehicle: route[0][0], delta: route[0][1] }, text: explain(p, pos, route) };
}

const logic: GameLogic<TrotroPuzzle, TrotroSolution, TrotroState> = {
  id: "trotro",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
