/**
 * Stacked: a block slides back and forth above the tower; JUMP drops it. The part that overhangs the
 * block below is cut off, a drop within 2 px snaps clean (perfect), and a total miss ends the run.
 * Slide speeds are seeded per block from @/lib/rng. Score = blocks placed. Integer Q8 maths.
 */
import { createRng } from "@/lib/rng";
import { EV, type SimCore } from "./core";
import { FP } from "./fixed";
import { BTN } from "./input";

export interface TowerDef {
  id: string;
  name: string;
  /** arena width and starting block width, px */
  w: number;
  start: number;
  /** slide speed Q8 px per frame: base, gain per block, cap, seeded jitter (+/-) */
  speed: number;
  gain: number;
  maxSpeed: number;
  jitter: number;
  /** points for a full progress bar */
  target: number;
}

export const BLOCK_H = 12 * FP;
export const PERFECT = 2 * FP;
export const STACKED_MAX_FRAMES = 60 * 60 * 10;
export const STACKED_MAX_BLOCKS = 500;

export interface Placed {
  x: number;
  w: number;
}

export class StackedSim implements SimCore {
  readonly t: TowerDef;
  private seed: number;
  frame = 0;
  deaths = 0;
  finished = false;
  ev = 0;
  /** placed blocks, bottom first (index 0 is the base) */
  tower: Placed[];
  /** sliding block */
  x = 0;
  w: number;
  v: number;
  /** last cut-off piece (render) */
  cut: Placed | null = null;
  cutAt = -100;
  perfectStreak = 0;
  private prev = 0;

  constructor(t: TowerDef, seed: number) {
    this.t = t;
    this.seed = seed >>> 0;
    const W = t.w * FP;
    const bw = t.start * FP;
    this.tower = [{ x: Math.trunc((W - bw) / 2), w: bw }];
    this.w = bw;
    this.v = 0;
    this.spawn();
  }

  private spawn() {
    const n = this.tower.length;
    const rng = createRng(`${this.seed}:${n}`);
    const base = Math.min(this.t.maxSpeed, this.t.speed + this.t.gain * (n - 1));
    const sp = Math.max(64, base + rng.int(-this.t.jitter, this.t.jitter));
    const fromLeft = rng.chance(0.5);
    this.x = fromLeft ? -this.w : this.t.w * FP;
    this.v = fromLeft ? sp : -sp;
  }

  step(buttons: number) {
    this.ev = 0;
    if (this.finished) return;
    this.frame++;
    const pressed = (buttons & BTN.JUMP) !== 0 && (this.prev & BTN.JUMP) === 0;
    this.prev = buttons;
    // slide, bouncing at the arena edges (with one block width of overshoot)
    this.x += this.v;
    const lo = -this.w,
      hi = this.t.w * FP;
    if (this.x < lo) {
      this.x = lo + (lo - this.x);
      this.v = -this.v;
    } else if (this.x > hi) {
      this.x = hi - (this.x - hi);
      this.v = -this.v;
    }
    if (pressed) this.drop();
    if (!this.finished && this.frame >= STACKED_MAX_FRAMES) this.end(false);
  }

  private drop() {
    const top = this.tower[this.tower.length - 1];
    const dx = this.x - top.x;
    if (Math.abs(dx) <= PERFECT) {
      this.tower.push({ x: top.x, w: Math.min(this.w, top.w) });
      this.perfectStreak++;
      this.ev |= EV.PLACE | EV.PERFECT;
    } else {
      const l = Math.max(this.x, top.x),
        r = Math.min(this.x + this.w, top.x + top.w);
      if (r <= l) {
        this.cut = { x: this.x, w: this.w };
        this.cutAt = this.frame;
        return this.end(true);
      }
      this.cut = this.x < top.x ? { x: this.x, w: l - this.x } : { x: r, w: this.x + this.w - r };
      this.cutAt = this.frame;
      this.tower.push({ x: l, w: r - l });
      this.perfectStreak = 0;
      this.ev |= EV.PLACE | EV.CUT;
    }
    this.w = this.tower[this.tower.length - 1].w;
    if (this.tower.length - 1 >= STACKED_MAX_BLOCKS) return this.end(false);
    this.spawn();
  }

  private end(miss: boolean) {
    if (miss) {
      this.deaths = 1;
      this.ev |= EV.DEATH;
    }
    this.finished = true;
    this.ev |= EV.FINISH;
  }

  score() {
    return this.tower.length - 1;
  }
  cleared() {
    return this.finished ? 1 : 0;
  }
  progress() {
    return Math.min(1, this.score() / this.t.target);
  }

  clone(): this {
    const c = Object.create(StackedSim.prototype) as this;
    Object.assign(c, this);
    c.tower = this.tower.map((b) => ({ ...b }));
    c.cut = this.cut && { ...this.cut };
    return c;
  }
}
