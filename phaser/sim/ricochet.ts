/**
 * Ricochet: Spuz flies between two walls. Gravity pulls down, JUMP flaps up, every wall touch scores a
 * point and turns Spuz around, and the wall it now heads for grows a new seeded spike pattern. Speed rises
 * with the score. Top and bottom are spiked. One life: the run ends on the first hit.
 * Integer Q8 maths; spike patterns come from the seeded rng in @/lib/rng.
 */
import { createRng } from "@/lib/rng";
import { EV, type SimCore } from "./core";
import { FP, idiv } from "./fixed";
import { BTN } from "./input";

export interface ArenaDef {
  id: string;
  name: string;
  /** arena size in px */
  w: number;
  h: number;
  /** wall spike slots between the top and bottom spike rows */
  slots: number;
  /** horizontal speed in Q8 px per frame at score 0, gain per point, cap */
  speed: number;
  gain: number;
  maxSpeed: number;
  gravity: number;
  flap: number;
  /** spikes per wall: base, +1 every `every` points, cap */
  spikes: number;
  every: number;
  maxSpikes: number;
  /** points for a full progress bar */
  target: number;
}

export const BIRD = 12 * FP;
/** top and bottom spike strip height in px */
export const STRIP = 12;
/** longest run: 10 minutes */
export const RICOCHET_MAX_FRAMES = 60 * 60 * 10;

export class RicochetSim implements SimCore {
  readonly a: ArenaDef;
  private seed: number;
  frame = 0;
  deaths = 0;
  finished = false;
  ev = 0;
  points = 0;
  x: number;
  y: number;
  vx: number;
  vy = 0;
  /** spiky slots on the left (0) and right (1) walls */
  walls: [boolean[], boolean[]];
  private prev = 0;
  /** frame of the last bounce (render) */
  bounceAt = -100;

  constructor(a: ArenaDef, seed: number) {
    this.a = a;
    this.seed = seed >>> 0;
    this.x = idiv(a.w * FP - BIRD, 2);
    this.y = idiv(a.h * FP - BIRD, 2);
    this.vx = a.speed;
    this.walls = [new Array(a.slots).fill(false), this.pattern()];
  }

  /** slot height in Q8 px */
  slotH(): number {
    return idiv((this.a.h - 2 * STRIP) * FP, this.a.slots);
  }

  private pattern(): boolean[] {
    const n = Math.min(this.a.maxSpikes, this.a.spikes + Math.floor(this.points / this.a.every));
    // a fresh stream per bounce keeps the sim cloneable and replayable
    const rng = createRng(`${this.seed}:${this.points}`);
    // always leave a gap of at least two neighbouring slots, so every wall is passable
    const gap = rng.int(1, this.a.slots - 3);
    const free = Array.from({ length: this.a.slots }, (_, i) => i).filter((i) => i !== gap && i !== gap + 1);
    const idx = rng.shuffle(free).slice(0, n);
    const out = new Array<boolean>(this.a.slots).fill(false);
    for (const i of idx) out[i] = true;
    return out;
  }

  private speedNow(): number {
    return Math.min(this.a.maxSpeed, this.a.speed + this.a.gain * this.points);
  }

  step(buttons: number) {
    this.ev = 0;
    if (this.finished) return;
    this.frame++;
    const pressed = (buttons & BTN.JUMP) !== 0 && (this.prev & BTN.JUMP) === 0;
    this.prev = buttons;
    if (pressed) {
      this.vy = -this.a.flap;
      this.ev |= EV.JUMP;
    }
    this.vy = Math.min(this.vy + this.a.gravity, 6 * FP);
    this.y += this.vy;
    this.x += this.vx;
    const right = this.a.w * FP - BIRD;
    if (this.x <= 0 || this.x >= right) {
      const side = this.x <= 0 ? 0 : 1;
      this.x = side === 0 ? 0 : right;
      if (this.hitsWall(side)) return this.die();
      this.points++;
      this.ev |= EV.BOUNCE;
      this.bounceAt = this.frame;
      const sp = this.speedNow();
      this.vx = side === 0 ? sp : -sp;
      this.walls[1 - side] = this.pattern();
      this.walls[side] = new Array(this.a.slots).fill(false);
    }
    if (this.y < STRIP * FP || this.y + BIRD > (this.a.h - STRIP) * FP) return this.die();
    if (this.frame >= RICOCHET_MAX_FRAMES) {
      this.finished = true;
      this.ev |= EV.FINISH;
    }
  }

  /** Spike hitbox: the middle 70% of each spiky slot. */
  private hitsWall(side: number): boolean {
    const sh = this.slotH();
    const top = STRIP * FP;
    const pad = idiv(sh * 15, 100);
    return this.walls[side].some((spiky, i) => {
      if (!spiky) return false;
      const y0 = top + i * sh + pad,
        y1 = top + (i + 1) * sh - pad;
      return this.y + BIRD > y0 && this.y < y1;
    });
  }

  private die() {
    this.deaths = 1;
    this.finished = true;
    this.ev |= EV.DEATH | EV.FINISH;
  }

  score() {
    return this.points;
  }
  cleared() {
    return this.finished ? 1 : 0;
  }
  progress() {
    return Math.min(1, this.points / this.a.target);
  }

  clone(): this {
    const c = Object.create(RicochetSim.prototype) as this;
    Object.assign(c, this);
    c.walls = [this.walls[0].slice(), this.walls[1].slice()];
    return c;
  }
}
