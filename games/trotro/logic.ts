/**
 * Trotro Jam: a sliding-vehicles puzzle on a 6 × 6 lorry station. Every vehicle slides along its own axis
 * (cars are 2 long, trucks 3 long); slide the others out of the way until the trotro (2 long, horizontal, on
 * the exit row) reaches the exit on the right edge. A slide of any distance is one move.
 *
 * Generation: a lot's position space is every position reachable from it (breadth-first); a second,
 * multi-source BFS from the solved positions gives the true minimum moves for each one. Every level starts
 * from one of a bank of deep lots (found offline by a long hill climb, see `climb`) and takes a short random
 * walk from it, swapping one vehicle at a time (thinning the lot to the level's vehicle count) and keeping
 * only lots that stay deep enough, so every seed gets its own lot in a bounded number of searches (well
 * under half a second). Hard and up take the walked lot's hardest position; easy and medium take a position
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
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { others: [6, 8], trucks: 0.25, range: [6, 10], hardest: false, cap: 8000, drift: 60 },
  medium: { others: [8, 10], trucks: 0.3, range: [11, 16], hardest: false, cap: 8000, drift: 60 },
  hard: { others: [9, 12], trucks: 0.3, range: [20, 60], hardest: true, cap: 6000, drift: 4 },
  expert: { others: [10, 12], trucks: 0.3, range: [21, 60], hardest: true, cap: 6000, drift: 2 },
  mega: { others: [10, 12], trucks: 0.35, range: [22, 60], hardest: true, cap: 6000, drift: 1 },
};
/** Vehicle swaps the walk from a deep lot keeps, and the most it tries (each try is one search). */
const WALK_SWAPS = 10;
const WALK_STEPS = 64;
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

/* Deep lots (22 to 46 moves at their hardest position), 4 characters a vehicle: length, axis, line,
 * offset. The trotro comes first. Found offline with `climb`; every seed walks away from one of them. */
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

/**
 * A random walk from a deep lot: each step swaps one vehicle (see `mutate`) and keeps the new lot when its
 * hardest position still needs between `need` and `hi` moves, and no more than `spec.drift` fewer than the
 * current one. It stops after `WALK_SWAPS` kept swaps with the vehicle count in the level's range, or after
 * `WALK_STEPS` tries, so the time stays bounded.
 */
function walk(rng: Rng, spec: Spec, need: number, hi: number): Found {
  const start = decodeLot(rng.pick(DEEP_LOTS));
  let cur = hardestOf(start.vehicles, start.pos, SPACE_CAP)!;
  const fits = (f: Found) => f.vehicles.length - 1 >= spec.others[0] && f.vehicles.length - 1 <= spec.others[1];
  for (let step = 0, swaps = 0; step < WALK_STEPS && (swaps < WALK_SWAPS || !fits(cur)); step++) {
    const { vehicles, pos } = mutate(rng, spec, cur);
    const h = hardestOf(vehicles, pos, spec.cap);
    if (h && h.d >= need && h.d <= hi && h.d >= cur.d - spec.drift) {
      cur = h;
      swaps++;
    }
  }
  return cur;
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
 * but the count has a long tail (seconds), so it only runs offline to fill `DEEP_LOTS`:
 * `climb(createRng("trotro-bank:" + i), SPEC.mega)` (and expert), keeping lots of 22 moves or more, encoded
 * with `encodeLot`.
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
    const c = walk(rng, spec, lo, hi);
    return finish(c.vehicles, c.space, c.index);
  }
  // Easy and medium aim for a par drawn evenly from the range (most spaces are full of short positions).
  const want = rng.int(lo, hi);
  // Any lot whose hardest position is `want` or more has a position exactly `want` from the exit (one step
  // along a shortest route at a time), so walk until the lot is thin enough and take one of those.
  const c = walk(rng, spec, want, Infinity);
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
