/**
 * Trotro Jam: a sliding-vehicles puzzle on a 6 × 6 lorry station. Every vehicle slides along its own axis
 * (cars are 2 long, trucks 3 long); slide the others out of the way until the trotro (2 long, horizontal, on
 * the exit row) reaches the exit on the right edge. A slide of any distance is one move.
 *
 * Generation: a lot's position space is every position reachable from it (breadth-first); a second,
 * multi-source BFS from the solved positions gives the true minimum moves for each one. Every level starts
 * from one of two banks of lots found offline by a long hill climb (see `climb`): 192 deep, crowded lots for
 * hard and up, 128 lighter ones for easy and medium. It takes a short random walk from it, swapping one
 * vehicle at a time (thinning the lot to the level's vehicle count) and keeping only lots that stay deep
 * enough, then drops vehicles one at a time if the walk ran out of tries still over the count, so every seed
 * gets its own lot with the level's vehicle count in a bounded number of searches (well under half a second). Hard and up take the walked lot's hardest position; easy and medium take a position
 * exactly the par they drew from their range. The server verifies by replaying the move log, slide by slide.
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
  /** how far the walk from a deep lot may let the hardest position's minimum drop per step */
  drift: number;
  /** the bank the walk starts from: crowded deep lots, or lighter mid lots that thin to a small count */
  bank: "deep" | "mid";
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { others: [6, 8], trucks: 0.25, range: [6, 10], hardest: false, cap: 8000, drift: 60, bank: "mid" },
  medium: { others: [8, 10], trucks: 0.3, range: [11, 16], hardest: false, cap: 8000, drift: 60, bank: "mid" },
  hard: { others: [9, 12], trucks: 0.3, range: [20, 60], hardest: true, cap: 6000, drift: 4, bank: "deep" },
  expert: { others: [10, 12], trucks: 0.3, range: [21, 60], hardest: true, cap: 6000, drift: 2, bank: "deep" },
  mega: { others: [10, 12], trucks: 0.35, range: [22, 60], hardest: true, cap: 6000, drift: 1, bank: "deep" },
};
/** Vehicle swaps the walk from a deep lot keeps, and the most it tries (each try is one search). */
const WALK_SWAPS = 10;
const WALK_STEPS = 64;
/** Walks (each from a fresh bank lot) before settling for the last one; a second walk is already rare. */
const WALK_TRIES = 4;
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

export interface Space {
  /** positions in the space */
  size: number;
  /** minimum moves to the exit per position (Infinity when the trotro can never leave); position 0 is `pos` */
  dist: Float64Array;
  /** the offsets of position `i` */
  at(i: number): number[];
  /** a fewest-move route from position `i` to the exit, or null when it has none */
  route(i: number): Move[] | null;
}

/**
 * The whole position space reachable from `pos`, with each position's minimum moves to the exit
 * (Infinity when the trotro can never leave). Moves are reversible, so one BFS from every solved position
 * gives exact distances. Null when the space passes `cap`.
 */
export function distances(p: Pick<TrotroPuzzle, "size" | "vehicles">, pos: number[], cap = SPACE_CAP): Space | null {
  // Hot loop of the generator, so nothing is allocated per position or move. Positions are numbered in
  // discovery order; each keeps its offsets in `offs` (n per position) and its base-5 key in `keys`, found
  // again through an open-addressing hash table. `edges` is a flat neighbour list with `from` offsets.
  const { size, vehicles } = p;
  const n = vehicles.length;
  const pow = new Float64Array(n);
  const base = new Int32Array(n),
    stride = new Int32Array(n),
    len = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    pow[i] = 5 ** i;
    const v = vehicles[i];
    base[i] = v.axis === "h" ? v.line * size : v.line;
    stride[i] = v.axis === "h" ? 1 : size;
    len[i] = v.len;
  }
  let tableSize = 1024;
  while (tableSize < cap * 2) tableSize *= 2;
  const mask = tableSize - 1;
  const slot = new Int32Array(tableSize).fill(-1);
  const keys = new Float64Array(cap);
  const offs = new Int8Array(cap * n);
  const from = new Int32Array(cap + 1);
  let edges = new Int32Array(cap * 8);
  let edgeCount = 0;
  const hash = (k: number) => Math.imul((k >>> 0) ^ Math.floor(k / 4294967296), 0x9e3779b1) >>> 0;
  /** index of key `k`, adding it (with offsets `src` moved by `dv` for vehicle `iv`) when new; -1 past the cap */
  let count = 0;
  const find = (k: number, src: number, iv: number, dv: number) => {
    let h = hash(k) & mask;
    for (;;) {
      const j = slot[h];
      if (j < 0) break;
      if (keys[j] === k) return j;
      h = (h + 1) & mask;
    }
    if (count >= cap) return -1;
    const j = count++;
    slot[h] = j;
    keys[j] = k;
    offs.copyWithin(j * n, src * n, src * n + n);
    offs[j * n + iv] += dv;
    return j;
  };
  // The start is position 0 (its offsets are copied onto themselves).
  for (let i = 0; i < n; i++) offs[i] = pos[i];
  find(keyOf(pos), 0, 0, 0);
  const occ = new Int8Array(size * size);
  for (let s = 0; s < count; s++) {
    from[s] = edgeCount;
    const o = s * n;
    occ.fill(-1);
    for (let i = 0; i < n; i++) for (let c = 0, cell = base[i] + offs[o + i] * stride[i]; c < len[i]; c++, cell += stride[i]) occ[cell] = i;
    const key = keys[s];
    for (let i = 0; i < n; i++) {
      const at = offs[o + i],
        l = len[i],
        b = base[i],
        st = stride[i];
      for (let dir = -1; dir <= 1; dir += 2)
        for (let d = dir; ; d += dir) {
          const edge = dir < 0 ? at + d : at + l - 1 + d;
          if (edge < 0 || edge >= size || occ[b + edge * st] !== -1) break;
          const j = find(key + d * pow[i], s, i, d);
          if (j < 0) return null;
          if (edgeCount === edges.length) {
            const grown = new Int32Array(edges.length * 2);
            grown.set(edges);
            edges = grown;
          }
          edges[edgeCount++] = j;
        }
    }
  }
  from[count] = edgeCount;
  const dist = new Float64Array(count).fill(Infinity);
  let frontier = new Int32Array(count),
    next = new Int32Array(count);
  let fl = 0;
  for (let s = 0; s < count; s++)
    if (offs[s * n] === EXIT_COL) {
      dist[s] = 0;
      frontier[fl++] = s;
    }
  for (let d = 1; fl; d++) {
    let nl = 0;
    for (let f = 0; f < fl; f++) {
      const s = frontier[f];
      for (let e = from[s]; e < from[s + 1]; e++) {
        const t = edges[e];
        if (dist[t] === Infinity) {
          dist[t] = d;
          next[nl++] = t;
        }
      }
    }
    [frontier, next] = [next, frontier];
    fl = nl;
  }
  const at = (i: number) => Array.from(offs.subarray(i * n, i * n + n));
  const route = (i: number) => {
    if (dist[i] === Infinity) return null;
    const out: Move[] = [];
    for (let s = i; dist[s] > 0;) {
      let t = from[s];
      while (dist[edges[t]] !== dist[s] - 1) t++;
      const j = edges[t];
      for (let v = 0; v < n; v++) {
        const d = offs[j * n + v] - offs[s * n + v];
        if (d) {
          out.push([v, d]);
          break;
        }
      }
      s = j;
    }
    return out;
  };
  return { size: count, dist, at, route };
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

/** A lot at its hardest position (`index` in `space`), `d` moves from the exit. */
export type Found = { vehicles: Vehicle[]; pos: number[]; d: number; space: Space; index: number };

/** One vehicle swapped: drop a random one and/or add a random car or truck, steering the count into range. */
function mutate(rng: Rng, spec: Spec, cur: Found): { vehicles: Vehicle[]; pos: number[] } {
  const vehicles = cur.vehicles.slice();
  const pos = cur.pos.slice();
  const others = vehicles.length - 1;
  const drop = others > spec.others[0] && (others >= spec.others[1] || rng.chance(0.5));
  if (drop) {
    const i = rng.int(1, vehicles.length - 1);
    vehicles.splice(i, 1);
    pos.splice(i, 1);
  }
  // Over the range, a step only drops (so a crowded bank lot thins out to the level's count).
  if (others <= spec.others[1] && (!drop || rng.chance(0.7))) addVehicles(rng, vehicles, pos, 1, spec.trucks);
  return { vehicles, pos };
}

/* Deep lots (22 to 46 moves at their hardest position, 9 to 13 other vehicles), 4 characters a vehicle:
 * length, axis, line, offset. The trotro comes first. Found offline with `climb`; every hard, expert and mega
 * seed walks away from one of them. */
// prettier-ignore
const DEEP_LOTS: readonly string[] = [
  "2h202h332v033v202v342h042v413h502h412v303v512h31", "2h213h312h032v312v202v012h442v502v522v412v342v03",
  "2h212v322v233h522h432h502v402v302h302v202h002v013v50", "2h232v002h502h332h022h442v222v243v022h123v512v342h04",
  "2h222h042v303h312v522v242h143h002h532v113v013h43", "2h212h022v502v312h313v522v403h532v102v332v032v012v24",
  "2h222h122v502h503v022h442v243v412v522h002h542v343h31", "2h203v222v412v342v002h123h032h333h502h012v522v132v54",
  "2h202h333v403h012v042v212v232h532v502h512h442v52", "2h232v222h102v522h522h032h442h542v502v202h132v332v03",
  "2h202h313v312h032v542h342v442v032h012v212h502h52", "2h223v003v102h132v202h442h513v512h532h302v232v332h04",
  "2h223h102h132h442h542h032h332v232v502v522v342v033h00", "2h223h033v003v512h302h542h402v422v242h122v342h322h01",
  "2h203v033v322h012h442v212h532h512v502h132v522h312h03", "2h233v502v122h022v402h002h112v433v222v142h542v043v33",
  "2h203h133h033h402v002h512h332v212h012h542v532v34", "2h212h042h512h022v103v412h443v512h322v002h302h122v34",
  "2h212h003v412h033v022h102v343h312v522h442h542h502v20", "2h202h033h132h332v212h312v522h502v542h413h002v032v34",
  "2h202h042h022h332v442h412v342v212v032v102h312v532v51", "2h203v522v142h122v222v322h142v002v422h303h422h542h01",
  "2h212v523h022v012v032h502h003h322h442h142v312h542v24", "2h222h532h512h013v503v002v332h442v302v112v042h302v23",
  "2h202h332h503h002v032v223h523h422h142h033v532v31", "2h202v313v202v002v522v433h032h422v542h142v103v033h52",
  "2h202h112h433h332h512h043v222v002v542v312h532h012v41", "2h202h442v302v523h003h412h142v042v212h323h512h302h54",
  "2h202v032v343v403h113h502v532v512h412h332h022v002v22", "2h212h342v412h102v332v203h532h032v503h402v312h512v02",
  "2h212h032v202v043v132h103v502v332h342v312h532v02", "2h212v322h002v302v233h433h512v522h302h542v422v012h04",
  "2h232v302h312h333v102v212v442v022h412v523h502h042v54", "2h203h502v132v312v542h032h342v032v442h012h322v212v50",
  "2h202h333v512v222h522h302v443h032v142h112v002h012v31", "2h223v022v502v123v403v522h542v142h112h522h432v233h01",
  "2h213h113v022v513v412h542h432v242h042h502h022v53", "2h223h012v503v022h502v112v132h522v232h442v523v402v00",
  "2h212v442v322v012v202h342v502h512v232v342h002h132h30", "2h223h522v512v043v412v012h433v102h303v532v232h04",
  "2h203v523h532v222h032h513v032h122v412v102v432v332h41", "2h222v443v102v202v423v532h502v302h303v002h042h522h40",
  "2h223v403v022h502h443v122v102v242h532h022v512h122v33", "2h222h132h323h012v342v033v002v422h043v112h442h503v51",
  "2h202h332h012v443v513v033v132v302h043v222h112h52", "2h212v202h542h342h503v502v032v342h032h412v012h132v32",
  "2h223v512h123v002h312h042h443v102v422h532h022v332h50", "2h203h013h523v322h342v032v003v402v222v502h412v54",
  "2h202h332v342v002v033v513h503v202h312v442v102h04", "2h213h012h042h302h443v512h322v422h543v002h522h112v14",
  "2h202v002h532v102v033h312v313v203v532h042h142h50", "2h202h522h012v043h422v142h032h142v313v523v212v002h54",
  "2h212h122v132h323v412h442v242h013v512h032v342h102h50", "2h212h542v523h122h102v503h022h312h002v322v243h432v03",
  "2h222h543v033v402h002h522v332v012v143v502v302h342h44", "2h202h112v002h013h302v302v322h042h533v412h432v24",
  "2h202h332v522v502h012v002h542h442h423v402v222v132v30", "2h222v342h312h332v112h503v512h542v012h002v202v032v41",
  "2h233h302v112v522v212h012v242h502v332v502v402h532h44", "2h213h503h432v002v523v022v102v322v402h022h532v502v23",
  "2h202v432h012h303h402v332h122v222h142v002v522v54", "2h223h022h532v523v412h442v232v102v012h512v042v503v12",
  "2h202v522v502h442v312v332v212h502v412h313h522v003h01", "2h202h342v402v542v102v212h532v242v502v312h312h022v33",
  "2h212h342v022v542v322v512h422v132h122v002v042v443h03", "2h202h332h502h312h442v522h042v033v303h002h542v242h14",
  "2h202v212h332h042v522v442h412h022v102v032v342h312v54", "2h223h523h322h502h422v302v412h303v512h442v202h043v00",
  "2h213h332v402h542v012v312h402v342v232v502h023h502h00", "2h212h322h042h523h013v003v512h303h432h542v142h112v42",
  "2h223h012h042h322v423v512v012v342h443v113h122h502v03", "2h212h332h542v032v313h032h442v522h312v012h142v242v20",
  "2h202h302v432v413h022h122v103v332v042v222h412h543v52", "2h202v223v522v443h412h522h012h502h332h042v002h142v03",
  "2h202v322v512v232v343v402v542v213h502h022h302v00", "2h203h112h303v412v222v242h012v532v512h043v332h542v04",
  "2h222h542v122v043v412v012v503h112v142h012h033v233v52", "2h212v202h502v132h343h032h142v542v242v023v312h102h43",
  "2h212h432h412v102h032h543v023h312v422h522v003v522v31", "2h212v042v243v412h042h302h542v342h323v512v302v20",
  "2h222h503h022h322v502v242v422v523h433v122h002h53", "2h212v312v502v012v402h332v343h502h022v102v522v232h30",
  "2h202h543v412v042h523h302v323h422h122h102v532h042v51", "2h222v242h443v023v332h122v522h312v002h543h012v50",
  "2h222v343v512h322h542h043v122h512v422v002h443h012v02", "2h212v313h313h432h032v522h143v012h502h532v422v242h00",
  "2h203v412h313v032v142v242v302h012h043h102v522v332h53", "2h202h322h013h533v413h432h302v512h042v002v302h112v24",
  "2h223h312h043v012v302v422h142v243h532h432h503v522h00", "2h223v412v042h122h312v332h442h523v012h543v512h033v10",
  "2h223v002v033v102h503v413v512v342h122h442h042h022h31", "2h233h123h002v332v502v522h542h102h032v222v022h442h52",
  "2h222v332h112h512h013h533v502v122v412v043v012h342h41", "2h203v522h033v212v502v412h102v312h512h543h002h422v04",
  "2h212h332h312v102h442v413v512v032h022v002v342h042h51", "2h233v332h303v522v502v232v212h542v402h402v103v002h02",
  "2h213h332v022v543h523v402v232h402h102v503h00", "2h202v442h022v512h042v342v532v222h302v002h333h40",
  "2h203v223h502v342v002h333v512h112v302h042h012v41", "2h213h112h502v322v513h003h432v032h342v012v243v40",
  "2h222v333v512h042h302v043h512h442h022v003v103v41", "2h202h332v223h502v342v003v513h012v032h413h113v40",
  "2h202h342v402v332v233h512h012v542v302v212v002h40", "2h223h122h442h103h002v522v342v502v232v042h512h33",
  "2h213h302h122h432v533v412v242v512v323v002h032v10", "2h203v532v132h532v312v002h012v042h143h032h322h51",
  "2h202v032v243h022h102h342h313h432h002v503v312h50", "2h222v423v522v023h002v232h432v122v402h542v503h51",
  "2h202h433v522v223h512v412v312h542v002h113h402h02", "2h232v502v522v213h002h312h513v022h532h032v332h44",
  "2h202v323v222h433v503h022v002h512h132h532h342h11", "2h222h532v333h003v032h343h112h512v233v402v542v12",
  "2h233v512v022h402h333h502v343h022h312v212h542h10", "2h203v423h013v332v512v042h302v212h542v312h412v40",
  "2h203h022h522v212v142h432v232v003v312h302h342v54", "2h203v233v532v213v322v002v512h012v422h532v402v30",
  "2h202v513h122h342v442h103h502h033h002v222h422v03", "2h213h422h532v422h322h513h033v532v202h142v132v31",
  "2h202h103h023v522v212v232v502v412h432h542v042v31", "2h223v102v013h512v422h132h312v333h033v513v032h44",
  "2h223h033v513v033v102h442v012v202h313h512h132v33", "2h202v402h542h012v343h302h402v002v212v303v512h33",
  "2h232h302v302v112v332h012h512h443v212h142h532v52", "2h232v303h003h532h322h512v122h412v433v033v512v01",
  "2h232h543v502v212h322v042v112v012v433h023v132v34", "2h222v503h002h523v522v012h302v232v142h543v412v30",
  "2h202h422v423h302v442h402h022v003h122v322h503v52", "2h202h013h102v302v512v412v032v322h522v222h432h41",
  "2h212v142v422h542h522v402h432h303h012v502v522v23", "2h212h332h003v232v013v302h142v032h542v522v132h44",
  "2h202v002v423h012v342v402v502h543v032v213v132h32", "2h203v523v212v432v103h523v032v312h142h423h022v00",
  "2h212h543v012v502v523h412v102v042h032h522v323v42", "2h203h132v002h113h402h303h522v532v222v432v332h01",
  "2h203v422v212v303h002v402v042v323v522h532h422h30", "2h202h132h312v033v332h412h542h033h002h103v512v21",
  "2h212h032h502v342h542h443v022h003v412h103h312v522v20", "2h223h332v042h123h003v502v122h513v012v342h442h032v23",
  "2h232v212h512v532v232v512h042v302h012h102h432h543v03", "2h223v412h502h532h022h043v002v522v032v332h442h313v10",
  "2h223v333h013v412v522v002h122h502v502v242v022h312h44", "2h212h102h432h343h512v322v042h042v542v232v022h002v30",
  "2h232v012v223h113v502v042v332h442h522h002h542h302h02", "2h232v212v302h533v002h513v532v232h042v512v332v432h30",
  "2h202v223h422h112v533h532v513v302h332h042h302v412v00", "2h213h033v023v532v132v322v002v433h522h502v203h132h42",
  "2h212v442v502v542h013h332v312h522h032h112h503v012v23", "2h212h333v522h142v232h532h003h023v012h432v312h512v04",
  "2h203v512v342v422h042h302h542h323h012v212h512h442v00", "2h213v402h402h002h443h323v012v202v502h542h502v522v34",
  "2h202h032h132h303h103h002v532v512v042h542v432h422v22", "2h232h342v512h112v543v012v042v302v222h002h043h522h42",
  "2h202h302h142h043v312v522v422v542v002v212v233h522v14", "2h203h132v032h312h032v522h502v212v343h002v542h332h41",
  "2h223v413v102v512h022h042h122v012h512v232h302h532h44", "2h212v322v032v012h433v522h312h502v503v412v242h123h02",
  "2h213h002v402v422v012v142h302v232h542h522v502h433v52", "2h202v532v432v042h542h423h123h512v512h032h103h002v22",
  "2h232h133v502h342h502v013h022h312v212h412h532v032v33", "2h213h312h002v312h522h103h032h542h142v533v022h412v20",
  "2h203h422v532h512v512v222v003h012v042v133v402h532h11", "2h233v003h312v112h542v402h412h443v502h012v342h502v03",
  "2h202h432v002v313h312v213v532h522h142h502h042v032h02", "2h222h102v232v042h542v502v022v302v523h002h513v413h43",
  "2h212v013v522h543h512h022v232v042h432v102h332h042v31", "2h223h512v542v233v403v012h022v122v042h122h002h342v33",
  "2h202v313h412v432v542h522h302v202v522h042h142v222v00", "2h203h502h142v342h412v222v202v002v102h043v522v032h33",
  "2h202h142v003h402h012h303h033h522h122v332v223v522v43", "2h203h402h322h512h012v002v302v212h433h532h302v423v52",
  "2h202v032h442h103h312v502v342h503h002h542v212v522h03", "2h212h012h423v513h032h442h322h542h522h303v002v142v42",
  "2h203v512h332h422h442h012h512v002v212v303h303h532v40", "2h213h502v232v502v543h022v412h403h332h002v312v022h10",
  "2h222v423h033v102h443v002v032h132h502h533v512v332h31", "2h203h103h002h422h443h512v522v412v222v502h542v042v31",
  "2h232v212h302v232v042h012v502v332h032h132v523h522h44", "2h212v532h322v013h533v032h002h112v422v312v503h023v13",
  "2h223h312v342v242h443h022h122v522h502v502v022h002h54", "2h222h443h122v013v512h503v103h022v422h312h532v032v33",
  "2h232h522h012v212h142v302h412v522v543h313v022h502v11", "2h213v002h302h532h433h502h142v312v232h043v522h022v10",
  "2h232v213h302v112h532v302v042h512h012v522v432v542h14", "2h202v512v423h023h122h002h502v242h313h432v322h102v03",
  "2h223v412v022h122h312v513h023v102h442h532v042h512v33", "2h223v032v012h312v522v332h002h142v302v112h443h512v20",
  "2h212v422h302h513h432h003h022v322v502v522h532v012v23", "2h212v003v503v022v322h532h343h112h502v132h432h012v24",
  "2h213h102v022h132h042v512v142v532v042h023v422h543v23", "2h203v322h302h012h042h132h112v002v512v433h403h522v22",
  "2h222v023v422h542h402v503v233h102v523v332h002h133h02", "2h222h313v102h532h122h442h512v042v023v413h022v332v51",
];

/* Mid lots for easy and medium (8 or 9 other vehicles, 17 to 31 moves at their hardest position), found the
 * same way with the vehicle count held to 6 to 9, so the walk thins them to the level's count in a few swaps. */
// prettier-ignore
const MID_LOTS: readonly string[] = [
  "2h202v342h442v313v512v233h012h302v00", "2h202v002v212v402h013h313v423h533v30",
  "2h223v412v243h102h323v122h532h502v30", "2h223v512v402v112v232v423h012h302h43",
  "2h202v402v422v222v002h442v513v323h11", "2h222v333v513v233v103h532h042h442h30",
  "2h202h433v523h402v002h012v302v402v21", "2h222v412h032v202v523h402v012v432v11",
  "2h212v243v412h502h323h022v102h302h43", "2h222h502v233v413h433v003v102h303h03",
  "2h213h423v013v522h402h142h542v202v42", "2h202v333h022v313v032h312h412v213h51",
  "2h203v322h313v202h532h032v433v032h13", "2h203v403h012v222h533v323h402h342v00",
  "2h212v233h022v502v522h443v412h303v00", "2h222h313v103h532v332h443v513h032v24",
  "2h213v022h543v412v342v203h313v512h10", "2h222h442h002v402v332v113v502h312v30",
  "2h202h533v413v312v142h302v233v512v21", "2h202v222h343h002v442v032v332h412h03",
  "2h202v132v433v312v512v532h423h033v20", "2h203v422h022v213v523h412h042v102h31",
  "2h202h322v433h523v203h032h302h143v53", "2h202h313h032v322v432h133v203h523v03",
  "2h212h002v202v322v303v402v502h432v13", "2h202h412v042v433v213h022h003v503h51",
  "2h213v012h542h433v523h402v202h142v42", "2h203h402v223v323h013v502h542v002h34",
  "2h212v322v132v302h432v023v402h002v20", "2h213v303v522v432h042h422v142v412h52",
  "2h213v402h432v302v202v323v022v132h00", "2h212v412v202h102v432h533h032h402v02",
  "2h202v102h132v533v422h022v213h412h04", "2h213v423h313h022v243h532v312v522h14",
  "2h232v532v002v212v512h433h402v302h04", "2h202v542h142v222v522v202v003h412v43",
  "2h223v012v233v512h333v403h502v343h11", "2h223v102h312h522h442h123v412h542v33",
  "2h203v212v142h032h013v422h422v502v32", "2h222h122v233v413v002h513h432h542h30",
  "2h212h113v413h432v232h303v002h502h52", "2h203v413h303v322v243v512h443h012v00",
  "2h223v423h312v242v302v112h142h53", "2h202h143h412v432v103h033v202v542v52",
  "2h223v512h442h132h523v102v332h542h31", "2h203h302h332h502v212v402h012v003v51",
  "2h202h532h113v302v003v512h332v222v24", "2h212v202h432h402v413v313h032v022h10",
  "2h202v502v522v333h022v242h442v222v04", "2h203h412h022v212h042v103v522h143v43",
  "2h202v303h002h442v502v522v212h422v03", "2h202v002v542v523h402v332h142v222h12",
  "2h223v413v002h442v233h502v342h303h03", "2h212v532v322h432v043v232h302v302v51",
  "2h213v412v513v002h302v233h432h522h50", "2h202h543v202h142v342v432v033h313v52",
  "2h202v222h032v312h013h412v442v002h33", "2h203h112v502v522v222v243h022v412h44",
  "2h202h343v502v133v212v332v443h512v31", "2h223v232h303v102v333v512h532h442h12",
  "2h232v332h443v512h042h022h313v102h52", "2h202h022v402h322v102v312v343v422h54",
  "2h222h522h302h443v413v102v513h022v23", "2h212h122v512h103h432v323v232h532h34",
  "2h202v443v533v222h042h512h333v302h012v00", "2h202v212h142h302v322v302v422v042v443h41",
  "2h203v503h532h442v222v332v312h302v003h02", "2h203h112v342v322v002v222h022v422h442v40",
  "2h202h312v033h012v212h342h423v312h042v44", "2h203v322h412v103v032h132v202v222v433h51",
  "2h202h343h313v302v212v502v003h502v402h01", "2h203v422v103v032v403v322h022v223h532v24",
  "2h202v323v402v002v343h013v512h442v22", "2h213v322v043h512h343v502v202v022h002h13",
  "2h213h433h022v502v322v522h302v233v413v00", "2h202v203v513h402v102v222v412h332v342h04",
  "2h203h332h012h442h422v133v402v302v002v22", "2h222v422v403h012v232v112h432v522h30",
  "2h213h032v322v343v012h132v202v432h403h50", "2h233v512v402v432h313v333v202v142h54",
  "2h213v313h302v422h032v242h002h402v013h53", "2h222h042v303h432h503v413v513v112h322v24",
  "2h212h323h523v512h302v142v013v412h032v20", "2h223v512h332v412v203h302v302h042h543v00",
  "2h202v232h302v142h142v003h523v302v432v21", "2h223h002v012h333v402v302v232v032h432v11",
  "2h212v012v312h302h323v412v203h032h532v14", "2h212h402v313h032v202v532v022h513h422h10",
  "2h202v502v523h022h442h003v222v032v412h12", "2h202v002v242v322h013h302v302h043v522h43",
  "2h212h002h033v312h532v143v423v502v202h42", "2h203h412h142v212v003v312h522h033v422h01",
  "2h212v342h443v512v102h332h512h312h042h02", "2h203v403v312v242h112v223h012h342v033h53",
  "2h202v213h302h022v002v513h402v532v402h43", "2h203v212v523h022v032h002v502v433h522h42",
  "2h203h022h342v212h432v543h402v322h523h13", "2h213v002v243v413h023h432v522v323h30",
  "2h202v343v512h442h322v212h303h032h012v00", "2h203v533h522v402v002v212h302h022v422v23",
  "2h233v502v002h543h302h522v332v212v143h02", "2h232v442v002h023h402v212v022h343v333v50",
  "2h202h042v003h522v143v323h012h312v212v43", "2h202h533h432h312h002v242v402v422v032h50",
  "2h203v222h533v402h002v502h023v312v142h43", "2h202h442h022v312v502v033h102v222h422v52",
  "2h222h442v332v512h033h513v413v102h122h31", "2h213h432h342v243h022v412h322h502v132h00",
  "2h232h132h443v202h512v333v512h102h043h30", "2h202v322h123h432h102v242h502v412v032h31",
  "2h232v502v522h442v222v242v332h122h102v04", "2h222v443h412v112v522v422h522v202h13",
  "2h212v022h342v312v333v402h102v233h522h40", "2h222h332v112h042h512v343h012h312h443v51",
  "2h203h423v513h322h302h042h022v212v312v00", "2h202v202v533h422v422h302v512h042v222v10",
  "2h202h332h312h032v312v102v502v342v533v20", "2h222h503v413v022h532v002v522v242h322h03",
  "2h212v102h442v342h042h322h022v523v412h30", "2h212h033h313v412h542v042v142v012h522v20",
  "2h202h302h412v432v042v222h133h523v533h10", "2h202h103v403h432v032v242h502h342v322h31",
  "2h202h522v303v212h012v143v402h422v32", "2h202v442h523h413v503h023v033v212v322h34",
  "2h203h102h302v313v512h423v402v222h332v04", "2h202v212h033v422h423h523v133h132v002h01",
  "2h223v023v332h343h502h033v502v002v412v20", "2h202v432v223h402v532h022v002h122h143v32",
];

export const encodeLot = (vehicles: Vehicle[], pos: number[]) => vehicles.map((v, i) => `${v.len}${v.axis}${v.line}${pos[i]}`).join("");

export function decodeLot(s: string): { vehicles: Vehicle[]; pos: number[] } {
  const vehicles: Vehicle[] = [];
  const pos: number[] = [];
  for (let k = 0; k < s.length; k += 4) {
    vehicles.push({ len: Number(s[k]) as 2 | 3, axis: s[k + 1] as Axis, line: Number(s[k + 2]) });
    pos.push(Number(s[k + 3]));
  }
  return { vehicles, pos };
}

export const deepLots = () => DEEP_LOTS.map(decodeLot);
export const midLots = () => MID_LOTS.map(decodeLot);

const fits = (spec: Spec, f: Found) => f.vehicles.length - 1 >= spec.others[0] && f.vehicles.length - 1 <= spec.others[1];

/**
 * A random walk from a deep lot: each step swaps one vehicle (see `mutate`) and keeps the new lot when its
 * hardest position still needs between `need` and `hi` moves, and no more than `spec.drift` fewer than the
 * current one. It stops after `WALK_SWAPS` kept swaps with the vehicle count in the level's range, or after
 * `WALK_STEPS` tries, so the time stays bounded.
 */
function walk(rng: Rng, spec: Spec, need: number, hi: number): Found {
  const start = decodeLot(rng.pick(spec.bank === "mid" ? MID_LOTS : DEEP_LOTS));
  let cur = hardestOf(start.vehicles, start.pos, SPACE_CAP)!;
  for (let step = 0, swaps = 0; step < WALK_STEPS && (swaps < WALK_SWAPS || !fits(spec, cur)); step++) {
    const { vehicles, pos } = mutate(rng, spec, cur);
    const h = hardestOf(vehicles, pos, spec.cap);
    if (h && h.d >= need && h.d <= hi && h.d >= cur.d - spec.drift) {
      cur = h;
      swaps++;
    }
  }
  return fits(spec, cur) ? cur : (thinOut(spec, cur, need, hi) ?? cur);
}

/**
 * Drops vehicles from a lot still over the level's count, each time the one whose removal keeps the hardest
 * position deepest (still `need` to `hi` moves). Null when no single drop keeps it deep enough.
 */
function thinOut(spec: Spec, start: Found, need: number, hi: number): Found | null {
  let cur = start;
  while (cur.vehicles.length - 1 > spec.others[1]) {
    let best: Found | null = null;
    for (let i = 1; i < cur.vehicles.length; i++) {
      const h = hardestOf(
        cur.vehicles.filter((_, k) => k !== i),
        cur.pos.filter((_, k) => k !== i),
        spec.cap,
      );
      if (h && h.d >= need && h.d <= hi && (!best || h.d > best.d)) best = h;
    }
    if (!best) return null;
    cur = best;
  }
  return cur;
}

/** A walked lot with the level's vehicle count: a new walk (from another bank lot) when one can't thin out. */
function lotFor(rng: Rng, spec: Spec, need: number, hi: number): Found {
  let c = walk(rng, spec, need, hi);
  for (let k = 1; k < WALK_TRIES && !fits(spec, c); k++) c = walk(rng, spec, need, hi);
  return c;
}

/** The hardest solvable position in a layout's space, or null. */
function hardestOf(vehicles: Vehicle[], pos: number[], cap: number): Found | null {
  const sp = distances({ size: SIZE, vehicles }, pos, cap);
  if (!sp) return null;
  let far = -1;
  sp.dist.forEach((d, i) => {
    if (d !== Infinity && (far < 0 || d > sp.dist[far])) far = i;
  });
  return far >= 0 && sp.dist[far] > 0 ? { vehicles, pos: sp.at(far), d: sp.dist[far], space: sp, index: far } : null;
}

/**
 * Hill climb for deep lots: take the hardest position of a random layout, then keep swapping one vehicle
 * for a random new one (starting from that hardest position) while the depth does not drop, restarting
 * when it stalls. Random layouts alone rarely reach 20+ moves; this gets there in a few hundred searches,
 * but the count has a long tail (seconds), so it only runs offline to fill the banks, encoded with `encodeLot`:
 *   DEEP_LOTS  `climb(createRng("trotro-bank:" + i), SPEC.mega)` (and expert), lots of 22 moves or more;
 *   MID_LOTS   `climb(rng, { ...SPEC.medium, others: [6, 8] or [6, 9], range: [17, 60] })`, lots of 17 or more.
 * Each bank is deduplicated against the other lots.
 */
export function climb(rng: Rng, spec: Spec): Found | null {
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
    } else ({ vehicles, pos } = mutate(rng, spec, cur));
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
    const c = lotFor(rng, spec, lo, hi);
    return finish(c.vehicles, c.space, c.index);
  }
  // Easy and medium aim for a par drawn evenly from the range (most spaces are full of short positions).
  const want = rng.int(lo, hi);
  // Any lot whose hardest position is `want` or more has a position exactly `want` from the exit (one step
  // along a shortest route at a time), so walk until the lot is thin enough and take one of those.
  const c = lotFor(rng, spec, want, Infinity);
  const exact: number[] = [];
  c.space.dist.forEach((d, i) => d === want && exact.push(i));
  return finish(c.vehicles, c.space, rng.pick(exact));
}

/** The puzzle at position `i` of a searched space, with a fewest-move route as the stored solution. */
function finish(vehicles: Vehicle[], space: Space, i: number): Generated<TrotroPuzzle, TrotroSolution> {
  const moves = space.route(i)!;
  const puzzle: TrotroPuzzle = { size: SIZE, exitRow: EXIT_ROW, vehicles, start: space.at(i), par: moves.length };
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
