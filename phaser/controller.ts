/**
 * Runs a Rage Ridge simulation in real time: fixed 1/60 s steps from an accumulator, one recorded
 * button mask per step, an optional ghost replayed in parallel, and events for sound, motion and HUD.
 * No React and no Phaser here: the Board drives it and the Phaser scene only reads it to draw.
 */
import type { InputLog } from "@/games/types";
import { EV, type SimCore } from "./sim/core";
import { STEP_MS, framesToMs } from "./sim/fixed";
import { LogRecorder, readerFor } from "./sim/input";

export interface GhostRun<C extends SimCore = SimCore> {
  name: string;
  sim: C;
  log: InputLog;
  /** best progress reached at each ghost frame (for the "x s behind" read) */
  curve: Float64Array;
}

export interface ControllerHooks {
  /** every step that raised events */
  onEvents?(ev: number): void;
  /** the run started (first input) */
  onStart?(): void;
  onFinish?(): void;
}

/** Pre-runs a ghost log to find its progress curve. */
export function buildGhost<C extends SimCore>(name: string, make: () => C, log: InputLog): GhostRun<C> {
  const probe = make();
  const at = readerFor(log);
  const curve = new Float64Array(log.frames + 1);
  let best = 0;
  for (let f = 0; f < log.frames && !probe.finished; f++) {
    probe.step(at(f));
    best = Math.max(best, probe.progress());
    curve[f + 1] = best;
  }
  for (let f = probe.frame + 1; f <= log.frames; f++) curve[f] = best;
  return { name, sim: make(), log, curve };
}

export class RageController<C extends SimCore = SimCore> {
  sim: C;
  rec = new LogRecorder();
  ghost: GhostRun<C> | null = null;
  private ghostAt: ((f: number) => number) | null = null;
  /** buttons held by each source, merged every step */
  sources: Record<string, number> = {};
  started = false;
  paused = false;
  private acc = 0;
  hooks: ControllerHooks;
  /** wall-clock ms of the last death, for HUD motion */
  lastEv = 0;
  /** autostart: begin on the first press */
  constructor(sim: C, hooks: ControllerHooks = {}) {
    this.sim = sim;
    this.hooks = hooks;
  }

  /** Dev only: drive the run from a recorded log instead of live input. */
  private demo: ((f: number) => number) | null = null;
  playDemo(log: InputLog) {
    this.demo = readerFor(log);
    this.started = true;
    this.hooks.onStart?.();
  }

  setHooks(h: ControllerHooks) {
    this.hooks = h;
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  clearSources() {
    this.sources = {};
  }

  setGhost(g: GhostRun<C> | null) {
    this.ghost = g;
    this.ghostAt = g ? readerFor(g.log) : null;
  }

  /** Fast-forwards a saved log (resume). */
  restore(log: InputLog) {
    const at = readerFor(log);
    for (let f = 0; f < log.frames && !this.sim.finished; f++) {
      const b = at(f);
      this.sim.step(b);
      this.rec.push(b);
      this.stepGhost();
    }
    this.started = log.frames > 0;
  }

  buttons(): number {
    let b = 0;
    for (const k in this.sources) b |= this.sources[k];
    return b;
  }

  setSource(name: string, buttons: number) {
    this.sources[name] = buttons;
    if (buttons && !this.started && !this.paused && !this.sim.finished) {
      this.started = true;
      this.acc = 0;
      this.hooks.onStart?.();
    }
  }

  private stepGhost() {
    if (this.ghost && this.ghostAt && !this.ghost.sim.finished && this.ghost.sim.frame < this.ghost.log.frames) {
      this.ghost.sim.step(this.ghostAt(this.ghost.sim.frame));
    }
  }

  /** Advances by real elapsed ms. Returns the number of steps taken. */
  tick(dtMs: number): number {
    if (!this.started || this.paused || this.sim.finished) return 0;
    this.acc += Math.min(dtMs, 100);
    let n = 0;
    while (this.acc >= STEP_MS && n < 6) {
      this.acc -= STEP_MS;
      const b = this.demo ? this.demo(this.sim.frame) : this.buttons();
      this.sim.step(b);
      this.rec.push(b);
      this.stepGhost();
      n++;
      if (this.sim.ev) this.hooks.onEvents?.(this.sim.ev);
      if (this.sim.ev & EV.FINISH) {
        this.hooks.onFinish?.();
        break;
      }
    }
    if (n === 6) this.acc = 0;
    return n;
  }

  /** Interpolation factor between the last two steps (render smoothing). */
  alpha(): number {
    return Math.min(1, this.acc / STEP_MS);
  }

  timeMs(): number {
    return framesToMs(this.sim.frame);
  }

  log(): InputLog {
    return this.rec.toLog();
  }

  /**
   * Ghost delta in seconds: positive when the ghost is ahead of the player (player behind),
   * negative when the player leads.
   */
  ghostDelta(): number | null {
    if (!this.ghost) return null;
    const p = this.sim.progress();
    const c = this.ghost.curve;
    let lo = 0,
      hi = c.length - 1;
    if (c[hi] < p) return -(this.sim.frame - this.ghost.sim.frame) / 60 - 0.01;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (c[mid] >= p) hi = mid;
      else lo = mid + 1;
    }
    return (this.sim.frame - lo) / 60;
  }
}
