/**
 * Endless runner (Dash): Spuz runs right on its own, faster the farther it gets. JUMP leaps (hold for higher),
 * DOWN ducks (a smaller hitbox) or, in the air, drops fast. Obstacles come from a seeded stream: the same seed
 * gives the same run for everyone, and which kinds appear depends on the speed at that spot, so a run opens with
 * crates and cones and only later brings gaps, drones to duck, tall stacks and clusters.
 *
 * Two modes:
 * - endless: one hit ends the run (deaths 1, finished). Score = metres.
 * - target (Levels): reach `target` metres. A hit costs a death and restarts the same run from 0 m after a short
 *   pause; reaching the target finishes it.
 *
 * Integer Q8 maths everywhere (phaser/sim/fixed.ts) and a private mulberry32 whose state is a plain number, so a
 * run replays bit-identically on the server and a clone (bots, tests) carries the obstacle stream with it.
 */
import { hashSeed } from "@/lib/rng";
import { EV, type SimCore } from "./core";
import { FP, idiv, overlaps, type Rect } from "./fixed";
import { BTN } from "./input";

/** Pixels per metre on the HUD. */
export const M_PX = 10;
export const METRE = M_PX * FP;

/** Speed preset: px per frame in Q8 at the start, the cap, and the gain per 100 m. */
export interface RunPreset {
  start: number;
  cap: number;
  gain: number;
}

const q = (px: number) => Math.round(px * FP);

/** Difficulty presets: start speed, top speed and ramp. Easy opens at 2 px a frame (12 m/s) and tops out at 4. */
export const PRESETS = {
  easy: { start: q(2.0), cap: q(4.0), gain: q(0.2) },
  medium: { start: q(2.3), cap: q(4.4), gain: q(0.22) },
  hard: { start: q(2.6), cap: q(4.8), gain: q(0.24) },
  expert: { start: q(2.9), cap: q(5.2), gain: q(0.26) },
  mega: { start: q(3.2), cap: q(5.6), gain: q(0.28) },
} as const satisfies Record<string, RunPreset>;
export type PresetId = keyof typeof PRESETS;

/* ---------------- Body and physics (px, Q8 in the sim) ---------------- */

/** Spuz's drawn body: 16 px wide, 18 tall standing, 20 by 11 ducking. Hitboxes are a little smaller (forgiving). */
export const BODY = { w: 16, h: 18, duckW: 20, duckH: 11 } as const;
/** Hitbox: x offset and width from the runner's left edge, height standing and ducking. */
export const HIT = { x: q(3), w: q(10), stand: q(16), duck: q(9) } as const;
/** Take-off speed, gravity while JUMP is held on the way up (for at most HOLD_MAX frames), normal and fast-fall gravity. */
export const JUMP_V = q(5);
export const G_HOLD = q(0.25);
export const G = q(0.45);
export const G_FAST = q(1.2);
export const FAST_V = q(2);
export const HOLD_MAX = 16;
/** A press up to this many frames before landing still jumps on landing. */
export const JUMP_BUFFER = 6;
/** Falling this far into a gap is a crash. */
export const FALL_DEATH = q(6);
/** Level mode: frames of stillness after a crash before the run restarts. */
export const CRASH_PAUSE = 45;
/** Endless runs stop (no crash) after 30 minutes. */
export const RUN_MAX_FRAMES = 60 * 60 * 30;
/** Clear track before the first obstacle. */
export const WARMUP = q(260);

/* ---------------- Obstacles ---------------- */

export const KIND = {
  /** ground: jump */
  CRATE: 0,
  CONE: 1,
  HURDLE: 2,
  /** tall: needs a held jump */
  STACK: 3,
  /** no ground: jump across */
  GAP: 4,
  /** skims the ground: jump */
  DRONE_LOW: 5,
  /** head height: duck (or a big jump) */
  DRONE_HEAD: 6,
  /** high: harmless unless you jump into it */
  BALLOON: 7,
} as const;
export type Kind = (typeof KIND)[keyof typeof KIND];

/** Size of each kind, px: width, bottom, height. GAP's width is drawn per obstacle. */
export const SHAPE: Record<Kind, { w: number; y: number; h: number }> = {
  [KIND.CRATE]: { w: 14, y: 0, h: 14 },
  [KIND.CONE]: { w: 10, y: 0, h: 16 },
  [KIND.HURDLE]: { w: 24, y: 0, h: 11 },
  [KIND.STACK]: { w: 14, y: 0, h: 26 },
  [KIND.GAP]: { w: 32, y: 0, h: 0 },
  [KIND.DRONE_LOW]: { w: 16, y: 3, h: 9 },
  // An overhead beam on cables (owner, 14 Nov 2026: it must look duckable): its hit box starts 14 px up, over a ducking
  // Spuz (9) with room to spare, under a standing one (16).
  [KIND.DRONE_HEAD]: { w: 22, y: 13, h: 7 },
  [KIND.BALLOON]: { w: 14, y: 30, h: 12 },
};

export const isFlyer = (k: Kind) => k === KIND.DRONE_LOW || k === KIND.DRONE_HEAD || k === KIND.BALLOON;

/** One obstacle in world space (Q8): x is its left edge, y its bottom above the ground. */
export interface Obstacle {
  k: Kind;
  x: number;
  w: number;
  y: number;
  h: number;
}

/**
 * Speed gates (px per frame, Q8): a kind only spawns once the run is this fast at that spot. Easy reaches the
 * gates at about 125, 250, 400 and 600 m; Mega opens at 3.2 px a frame, so everything is in play from the start.
 */
export const GATE = { gaps: q(2.25), duck: q(2.5), tall: q(2.8), mixed: q(3.2) } as const;

/** Clear time between two patterns: land, see the next one, act. Plus a random extra up to EXTRA_FRAMES. */
export const CLEAR_FRAMES = 36;
export const CLEAR_PX = q(20);
export const EXTRA_FRAMES = 48;

type Piece = [k: Kind, dx: number, w?: number];
interface Pattern {
  gate: number;
  weight: number;
  /** pieces at px offsets from the pattern's start; `v` is the speed there in px per frame */
  make(v: number, r: (lo: number, hi: number) => number): Piece[];
}

const PATTERNS: Pattern[] = [
  { gate: 0, weight: 5, make: () => [[KIND.CRATE, 0]] },
  { gate: 0, weight: 4, make: () => [[KIND.CONE, 0]] },
  { gate: GATE.gaps, weight: 3, make: () => [[KIND.HURDLE, 0]] },
  { gate: GATE.gaps, weight: 3, make: (v, r) => [[KIND.GAP, 0, r(24, Math.max(26, Math.min(48, Math.floor(v * 12))))]] },
  { gate: GATE.duck, weight: 4, make: () => [[KIND.DRONE_HEAD, 0]] },
  { gate: GATE.tall, weight: 3, make: () => [[KIND.STACK, 0]] },
  { gate: GATE.tall, weight: 3, make: () => [[KIND.DRONE_LOW, 0]] },
  // a cluster: crate and cone close enough to clear in one held jump
  {
    gate: GATE.tall,
    weight: 3,
    make: (_v, r) => [
      [KIND.CRATE, 0],
      [KIND.CONE, 14 + r(4, 10)],
    ],
  },
  { gate: GATE.mixed, weight: 2, make: () => [[KIND.BALLOON, 0]] },
  {
    gate: GATE.mixed,
    weight: 2,
    make: () => [
      [KIND.CRATE, 0],
      [KIND.CRATE, 14],
      [KIND.CRATE, 28],
    ],
  },
  // a choice in a row: jump the crate, land, then duck the drone
  {
    gate: GATE.mixed,
    weight: 2,
    make: (v, r) => [
      [KIND.CRATE, 0],
      [KIND.DRONE_HEAD, 14 + Math.floor(v * 30) + r(0, Math.floor(v * 8))],
    ],
  },
  // a drone to duck, then a gap to jump
  {
    gate: GATE.mixed,
    weight: 1,
    make: (v, r) => [
      [KIND.DRONE_HEAD, 0],
      [KIND.GAP, 16 + Math.floor(v * 22), r(24, 32)],
    ],
  },
];

/** Run parameters a sim is built from. */
export interface RunDef {
  preset: RunPreset;
  seed: number;
  /** metres to reach (Levels); undefined for an endless run */
  target?: number;
}

export function seedOf(s: string | number): number {
  return (typeof s === "number" ? s : hashSeed(s)) >>> 0 || 1;
}

export class RunnerSim implements SimCore {
  readonly def: RunDef;
  frame = 0;
  deaths = 0;
  finished = false;
  ev = 0;
  /** distance run, Q8 px (the runner's left edge in world space) */
  dist = 0;
  speed = 0;
  /** feet height above the ground (negative while falling into a gap) and vertical speed, Q8 */
  y = 0;
  vy = 0;
  onGround = true;
  ducking = false;
  /** frames since take-off, frames left on the jump buffer */
  air = 0;
  buf = 0;
  /** fast fall started this jump */
  fast = false;
  /** level mode: frames left of the post-crash pause (0 when running) */
  crashT = 0;
  /** where and on what the last crash happened (render) */
  crashAt = { x: 0, y: 0, k: -1 as number };
  /** obstacles near the runner, in world order */
  obs: Obstacle[] = [];
  /** left edge of the next pattern */
  nextX = WARMUP;
  /** obstacles spawned this run (render variety) */
  spawned = 0;
  private rs = 0;
  private prev = 0;

  constructor(def: RunDef) {
    this.def = def;
    this.reset();
  }

  /** Back to the start line with a fresh copy of the same obstacle stream. */
  private reset() {
    this.dist = 0;
    this.speed = this.def.preset.start;
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.ducking = false;
    this.air = 0;
    this.buf = 0;
    this.fast = false;
    this.obs = [];
    this.nextX = WARMUP;
    this.spawned = 0;
    this.rs = this.def.seed >>> 0;
    this.fill();
  }

  /** mulberry32 on a plain number state (cloneable). */
  private rnd(): number {
    this.rs = (this.rs + 0x6d2b79f5) >>> 0;
    let t = this.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private int(lo: number, hi: number): number {
    return lo + Math.floor(this.rnd() * (hi - lo + 1));
  }

  /** Speed (Q8 px per frame) at a world position: it depends on distance only. */
  speedAt(x: number): number {
    const p = this.def.preset;
    return Math.min(p.cap, p.start + idiv(p.gain * Math.max(0, x), 100 * METRE));
  }

  /** Spawns patterns until the track is filled a screen and a half ahead. */
  private fill() {
    const ahead = this.dist + q(720);
    while (this.nextX < ahead) this.spawnPattern();
    let cut = 0;
    while (cut < this.obs.length && this.obs[cut].x + this.obs[cut].w < this.dist - q(80)) cut++;
    if (cut) this.obs.splice(0, cut);
  }

  private spawnPattern() {
    const v = this.speedAt(this.nextX);
    const open = PATTERNS.filter((p) => v >= p.gate);
    let total = 0;
    for (const p of open) total += p.weight;
    let pick = this.rnd() * total;
    let pat = open[open.length - 1];
    for (const p of open) {
      pick -= p.weight;
      if (pick < 0) {
        pat = p;
        break;
      }
    }
    const pieces = pat.make(v / FP, (lo, hi) => this.int(lo, hi));
    let end = this.nextX;
    for (const [k, dx, wpx] of pieces) {
      const s = SHAPE[k];
      const o: Obstacle = { k, x: this.nextX + q(dx), w: q(wpx ?? s.w), y: q(s.y), h: q(s.h) };
      this.obs.push(o);
      this.spawned++;
      end = Math.max(end, o.x + o.w);
    }
    this.nextX = end + CLEAR_PX + v * CLEAR_FRAMES + this.int(0, v * EXTRA_FRAMES);
  }

  /** The runner's hitbox this frame. */
  hitbox(): Rect {
    return { x: this.dist + HIT.x, y: this.y, w: HIT.w, h: this.ducking ? HIT.duck : HIT.stand };
  }

  /** True when the runner's feet have ground under them (any overlap with solid ground counts). */
  supported(): boolean {
    const l = this.dist + HIT.x,
      r = l + HIT.w;
    for (const o of this.obs) if (o.k === KIND.GAP && o.x <= l && r <= o.x + o.w) return false;
    return true;
  }

  step(buttons: number) {
    this.ev = 0;
    if (this.finished) return;
    this.frame++;
    const jump = (buttons & BTN.JUMP) !== 0;
    const down = (buttons & BTN.DOWN) !== 0;
    const pressed = jump && (this.prev & BTN.JUMP) === 0;
    this.prev = buttons;

    if (this.crashT > 0) {
      if (--this.crashT === 0) {
        this.reset();
        this.ev |= EV.RESPAWN;
      }
      return;
    }

    this.speed = this.speedAt(this.dist);
    this.dist += this.speed;
    this.fill();

    if (pressed) this.buf = JUMP_BUFFER;
    else if (this.buf > 0) this.buf--;

    if (this.onGround && !this.supported()) {
      this.onGround = false;
      this.vy = 0;
      this.air = HOLD_MAX;
    }
    if (this.onGround) {
      if (this.buf > 0) {
        this.buf = 0;
        this.onGround = false;
        this.ducking = false;
        this.fast = false;
        this.vy = JUMP_V;
        this.air = 0;
        this.ev |= EV.JUMP;
      } else this.ducking = down;
    }
    if (!this.onGround) {
      this.ducking = false;
      this.air++;
      let g = G;
      if (down) {
        if (!this.fast) {
          this.fast = true;
          this.vy = Math.min(this.vy, -FAST_V);
        }
        g = G_FAST;
      } else if (jump && this.vy > 0 && this.air <= HOLD_MAX) g = G_HOLD;
      const was = this.y;
      this.vy -= g;
      this.y += this.vy;
      // touch down from above (however fast), or catch the far lip of a gap while still shallow
      if (this.y <= 0 && this.vy <= 0 && this.supported() && (was >= 0 || this.y > -FALL_DEATH)) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
        this.fast = false;
        // a buffered press (this.buf) leaves the ground again next frame
        this.ev |= EV.LAND;
      } else if (this.y <= -FALL_DEATH) return this.crash(KIND.GAP);
    }

    const hb = this.hitbox();
    for (const o of this.obs) {
      if (o.x > hb.x + hb.w) break;
      if (o.k === KIND.GAP) continue;
      // obstacles are 1 px smaller than drawn on every side
      if (overlaps(hb, { x: o.x + FP, y: o.y + FP, w: o.w - 2 * FP, h: o.h - 2 * FP })) return this.crash(o.k);
    }

    if (this.frame >= RUN_MAX_FRAMES) return this.finish();
    if (this.def.target !== undefined && this.metres() >= this.def.target) {
      this.ev |= EV.CLEAR;
      return this.finish();
    }
  }

  private crash(k: number) {
    this.crashAt = { x: this.dist, y: this.y, k };
    this.deaths++;
    this.ev |= EV.DEATH;
    if (this.def.target === undefined) return this.finish();
    this.crashT = CRASH_PAUSE;
  }

  private finish() {
    this.finished = true;
    this.ev |= EV.FINISH;
  }

  /** Whole metres run (this attempt, in Levels). */
  metres(): number {
    return idiv(this.dist, METRE);
  }

  /** Speed as a share of the climb from start to cap, 0..1 (HUD pips, sky colour). */
  pace(): number {
    const p = this.def.preset;
    return p.cap === p.start ? 1 : Math.min(1, Math.max(0, (this.speed - p.start) / (p.cap - p.start)));
  }

  score() {
    return this.metres();
  }

  cleared() {
    return this.finished ? 1 : 0;
  }

  /** Levels: share of the target. Endless: m / (m + 500), always rising and never full, so ghost curves keep order. */
  progress() {
    const m = this.metres();
    if (this.def.target !== undefined) return Math.min(1, m / this.def.target);
    return m / (m + 500);
  }

  clone(): RunnerSim {
    const c = Object.create(RunnerSim.prototype) as RunnerSim;
    Object.assign(c, this);
    c.obs = this.obs.slice();
    c.crashAt = { ...this.crashAt };
    return c;
  }
}
