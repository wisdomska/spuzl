/**
 * Rage Ridge JSON level format (tiles, traps, triggers, timings), shared by every tile-based game.
 *
 * `tiles` rows, top to bottom, one character per 16 px tile:
 *   .  empty            #  solid ground        =  solid ledge (drawn as a slab)
 *   ^  floor spike      v  ceiling spike       S  start (feet on the tile bottom)
 *   E  exit door        H  hook or hold (Grapple, Slip)
 *   >  wall spike pointing right (base on its left)    <  wall spike pointing left
 *   1..9  cells owned by trap "1".."9": solid until a `drop` trap fires, empty until a
 *         `spikes` or `block` trap fires.
 * Traps fire from triggers (rectangles in tiles). Every attempt resets every trap, and after the
 * first death on a level the renderer telegraphs every trap (fair on retry, SRS 9.3).
 *
 * Troll kinds (opt-in: only levels that name them use them, so older games play exactly as before):
 *   fake    cells look like ground and never were (fall through a floor, walk through a wall)
 *   move    a solid group slides `by` tiles over `frames` once fired (`ease: "in"` accelerates: a
 *           falling ceiling; `back` sends it home after a rest: a press). It pushes the runner, and
 *           squeezing the runner into anything solid kills
 *   slide   a group of spikes travels `by` tiles over `frames` once fired (spikes that chase you)
 *   decoy   a second door at `at` that looks like the exit; once fired it bites (touching it kills)
 *   flip    gravity turns upside down once fired (inside `zone` only, when one is given)
 *   reverse left and right swap once fired (inside `zone` only, when one is given)
 *   saw     a spinning hazard pops out at `from` once fired and runs to `to` and back every `period`
 *   spikes  may name `dir` to point sideways (spikes out of a wall)
 */
import { TILE } from "./fixed";

export type TrapKind = "drop" | "spikes" | "block" | "exit" | "fake" | "move" | "slide" | "decoy" | "flip" | "reverse" | "saw";

/** Kinds that own no cells: they act on the door, the runner or a free-moving hazard. */
export const CELL_LESS: readonly TrapKind[] = ["exit", "decoy", "flip", "reverse", "saw"];

export type SpikeDir = "up" | "down" | "left" | "right";

export interface TrapDef {
  kind: TrapKind;
  /** frames between the trigger and the trap taking effect */
  delay: number;
  /** exit traps: tile the door runs to; saw: the far end of its run */
  to?: [number, number];
  /** exit, move and slide traps: frames the run takes */
  frames?: number;
  /** move and slide traps: how far the group travels, in tiles */
  by?: [number, number];
  /** move traps: "in" starts slow and speeds up like a falling weight (default steady) */
  ease?: "in" | "linear";
  /** move and slide traps: frames to rest at the far end before travelling home again (default: stay there) */
  back?: number;
  /** spikes: which way they point (default: up on the floor, down from a ceiling) */
  dir?: SpikeDir;
  /** decoy: the tile its door stands on (feet on the tile bottom, like E) */
  at?: [number, number];
  /** flip and reverse: [x, y, w, h] in tiles where the effect holds (default: everywhere once fired) */
  zone?: [number, number, number, number];
  /** saw: start tile (its centre), frames for a there-and-back loop (even), loop offset, radius in px */
  from?: [number, number];
  period?: number;
  phase?: number;
  r?: number;
}

/** A label drawn in the room (render only: the sim never reads it). */
export interface SignDef {
  /** tile the text sits on (bottom centre of the tile) */
  at: [number, number];
  text: string;
}

export interface TriggerDef {
  /** [x, y, w, h] in tiles */
  zone: [number, number, number, number];
  /** trap ids ("1".."9") fired when the runner enters the zone */
  fire: string[];
}

export interface PlatformDef {
  /** width in tiles */
  w: number;
  /** tile positions of both ends of the path */
  from: [number, number];
  to: [number, number];
  /** frames for a full there-and-back loop (even) */
  period: number;
  /** frame offset into the loop */
  phase?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  tiles: string[];
  traps?: Record<string, TrapDef>;
  triggers?: TriggerDef[];
  platforms?: PlatformDef[];
  /** jokes and lies painted into the room (render only) */
  signs?: SignDef[];
}

export const Cell = { Empty: 0, Solid: 1, Ledge: 2, SpikeUp: 3, SpikeDown: 4, Trap: 5, SpikeRight: 6, SpikeLeft: 7 } as const;

/** Spike direction codes used by `dirs` and `spikeCell`: 1 up, -1 down, 2 right, -2 left. */
export const DIR_CODE: Record<SpikeDir, number> = { up: 1, down: -1, right: 2, left: -2 };

export interface CompiledTrap extends TrapDef {
  id: string;
  cells: number[];
  /** spike cells: 1 points up, -1 points down (2 right, -2 left with an explicit `dir`) */
  dirs: number[];
}

export interface CompiledLevel {
  def: LevelDef;
  w: number;
  h: number;
  cells: Uint8Array;
  /** trap index per cell, -1 when none */
  trapOf: Int8Array;
  traps: CompiledTrap[];
  triggers: { x: number; y: number; w: number; h: number; fire: number[] }[];
  start: { x: number; y: number };
  exit: { x: number; y: number };
  hooks: { x: number; y: number }[];
  platforms: PlatformDef[];
}

const SOLIDS = new Set(["#", "="]);

/** Parses and validates a level. Throws with the level id on any authoring error. */
export function compileLevel(def: LevelDef): CompiledLevel {
  const h = def.tiles.length;
  const w = Math.max(...def.tiles.map((r) => r.length));
  if (!h || def.tiles.some((r) => r.length !== w)) throw new Error(`${def.id}: rows must share one width`);
  const cells = new Uint8Array(w * h);
  const trapOf = new Int8Array(w * h).fill(-1);
  const ids = Object.keys(def.traps ?? {}).sort();
  const traps: CompiledTrap[] = ids.map((id) => ({ ...def.traps![id], id, cells: [], dirs: [] }));
  let start: { x: number; y: number } | null = null;
  let exit: { x: number; y: number } | null = null;
  const hooks: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = def.tiles[y][x];
      const i = y * w + x;
      if (ch === "#") cells[i] = Cell.Solid;
      else if (ch === "=") cells[i] = Cell.Ledge;
      else if (ch === "^") cells[i] = Cell.SpikeUp;
      else if (ch === "v") cells[i] = Cell.SpikeDown;
      else if (ch === ">") cells[i] = Cell.SpikeRight;
      else if (ch === "<") cells[i] = Cell.SpikeLeft;
      else if (ch === "S") start = { x, y };
      else if (ch === "E") exit = { x, y };
      else if (ch === "H") hooks.push({ x, y });
      else if (ch >= "1" && ch <= "9") {
        const t = ids.indexOf(ch);
        if (t < 0) throw new Error(`${def.id}: cell ${x},${y} uses undefined trap ${ch}`);
        cells[i] = Cell.Trap;
        trapOf[i] = t;
        traps[t].cells.push(i);
      } else if (ch !== ".") throw new Error(`${def.id}: unknown tile "${ch}"`);
    }
  }
  if (!start) throw new Error(`${def.id}: no start`);
  if (!exit) throw new Error(`${def.id}: no exit`);
  const solidAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && SOLIDS.has(def.tiles[y][x]);
  for (const t of traps) {
    const bad = (why: string) => new Error(`${def.id}: ${t.kind} trap ${t.id} ${why}`);
    if (CELL_LESS.includes(t.kind)) {
      if (t.cells.length) throw bad("takes no cells");
    } else if (!t.cells.length) throw new Error(`${def.id}: trap ${t.id} has no cells`);
    if (t.kind === "exit" && (!t.to || !t.frames)) throw new Error(`${def.id}: exit trap ${t.id} needs to, frames and no cells`);
    if ((t.kind === "move" || t.kind === "slide") && (!t.by || !t.frames || t.frames < 1)) throw bad("needs by and frames");
    if (t.kind === "decoy" && !t.at) throw bad("needs at");
    if (t.kind === "saw" && (!t.from || !t.to || !t.period || t.period < 2 || t.period % 2)) throw bad("needs from, to and an even period");
    if (t.delay < 0) throw new Error(`${def.id}: trap ${t.id} negative delay`);
    t.dirs = t.cells.map((i) => {
      if (t.dir) return DIR_CODE[t.dir];
      const x = i % w,
        y = Math.floor(i / w);
      return solidAt(x, y + 1) || !solidAt(x, y - 1) ? 1 : -1;
    });
  }
  const triggers = (def.triggers ?? []).map((tr) => {
    const fire = tr.fire.map((id) => {
      const k = ids.indexOf(id);
      if (k < 0) throw new Error(`${def.id}: trigger fires undefined trap ${id}`);
      return k;
    });
    const [x, y, tw, th] = tr.zone;
    return { x: x * TILE, y: y * TILE, w: tw * TILE, h: th * TILE, fire };
  });
  for (const p of def.platforms ?? []) if (p.period < 2 || p.period % 2) throw new Error(`${def.id}: platform period must be even`);
  return { def, w, h, cells, trapOf, traps, triggers, start, exit, hooks, platforms: def.platforms ?? [] };
}
