/**
 * Wobble: Spuz walks a tightrope on its own. The lean is an inverted pendulum (it grows unless you
 * correct it), seeded gusts of wind push it around, LEFT and RIGHT push back. Past the limit Spuz falls
 * and the segment restarts after 300 ms, with the same wind (learnable, fair on retry).
 * Integer maths: angle in 1/1000 of the fall limit scale, wind from the seeded rng in @/lib/rng.
 */
import { createRng } from "@/lib/rng";
import { EV, type SimCore } from "./core";
import { FP, idiv } from "./fixed";
import { BTN } from "./input";

export interface RopeDef {
  id: string;
  name: string;
  /** rope length in px */
  length: number;
  /** walk speed, Q8 px per frame */
  speed: number;
  /** instability: lean acceleration = lean * k / 1024 */
  k: number;
  /** gusts on this rope, their strength range and length range (frames) */
  gusts: number;
  wind: [number, number];
  dur: [number, number];
  /** steady breeze (signed) */
  breeze: number;
}

export const LEAN_LIMIT = 1000;
export const PUSH = 10;
export const WOBBLE_RESPAWN = 18;
export const WOBBLE_PAUSE = 30;

export interface Gust {
  at: number;
  dur: number;
  force: number;
}

/** Gusts for one rope: spaced out, seeded. Same for every attempt. */
export function gustsFor(r: RopeDef, seed: number, index: number): Gust[] {
  const rng = createRng(`${seed}:${index}:${r.id}`);
  const frames = idiv(r.length * FP, r.speed);
  const out: Gust[] = [];
  const slot = Math.floor(frames / (r.gusts + 1));
  for (let i = 0; i < r.gusts; i++) {
    const at = slot * (i + 1) + rng.int(-Math.floor(slot / 3), Math.floor(slot / 3));
    const dur = rng.int(r.dur[0], r.dur[1]);
    const force = rng.int(r.wind[0], r.wind[1]) * (rng.chance(0.5) ? 1 : -1);
    out.push({ at, dur, force });
  }
  return out;
}

export class WobbleSim implements SimCore {
  readonly ropes: RopeDef[];
  readonly gusts: Gust[][];
  idx = 0;
  frame = 0;
  deaths = 0;
  finished = false;
  ev = 0;
  /** attempt frame on the current rope */
  t = 0;
  /** distance walked, Q8 px */
  pos = 0;
  lean = 0;
  spin = 0;
  dead = 0;
  pause = 0;
  splits: number[] = [];
  deathsHere = 0;

  constructor(ropes: RopeDef[], seed: number) {
    this.ropes = ropes;
    this.gusts = ropes.map((r, i) => gustsFor(r, seed, i));
  }

  rope(): RopeDef {
    return this.ropes[this.idx];
  }

  /** Wind force this frame on the current rope. */
  wind(t = this.t): number {
    const r = this.rope();
    let f = r.breeze;
    for (const g of this.gusts[this.idx]) if (t >= g.at && t < g.at + g.dur) f += g.force;
    return f;
  }

  private reset() {
    this.t = 0;
    this.pos = 0;
    this.lean = 0;
    this.spin = 0;
  }

  step(buttons: number) {
    this.ev = 0;
    if (this.finished) return;
    this.frame++;
    if (this.pause > 0) {
      this.pause--;
      if (!this.pause) {
        this.idx++;
        this.deathsHere = 0;
        this.reset();
      }
      return;
    }
    if (this.dead > 0) {
      this.dead--;
      if (!this.dead) {
        this.reset();
        this.ev |= EV.RESPAWN;
      }
      return;
    }
    const r = this.rope();
    this.t++;
    const dir = (buttons & BTN.RIGHT ? 1 : 0) - (buttons & BTN.LEFT ? 1 : 0);
    this.spin += idiv(this.lean * r.k, 1024) + this.wind() + dir * PUSH;
    this.spin -= idiv(this.spin, 32);
    this.lean += idiv(this.spin, 8);
    this.pos += r.speed;
    if (Math.abs(this.lean) > LEAN_LIMIT) {
      this.deaths++;
      this.deathsHere++;
      this.dead = WOBBLE_RESPAWN;
      this.ev |= EV.DEATH;
      return;
    }
    if (this.pos >= r.length * FP) {
      this.pos = r.length * FP;
      this.splits.push(this.frame);
      this.ev |= EV.CLEAR;
      if (this.idx === this.ropes.length - 1) {
        this.finished = true;
        this.ev |= EV.FINISH;
      } else this.pause = WOBBLE_PAUSE;
    }
  }

  score() {
    return 0;
  }
  cleared() {
    return this.splits.length;
  }
  progress() {
    if (this.finished) return 1;
    const part = this.pause ? 1 : Math.min(0.99, this.pos / (this.rope().length * FP));
    return (this.idx + part) / this.ropes.length;
  }
  metres() {
    let m = 0;
    for (let i = 0; i < this.idx; i++) m += Math.floor(this.ropes[i].length / 16);
    return m + Math.floor(this.pos / FP / 16);
  }

  clone(): this {
    const c = Object.create(WobbleSim.prototype) as this;
    Object.assign(c, this);
    c.splits = this.splits.slice();
    return c;
  }
}
