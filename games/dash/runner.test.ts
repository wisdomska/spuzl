import { describe, expect, it } from "vitest";
import { EV } from "@/phaser/sim/core";
import { FP } from "@/phaser/sim/fixed";
import { BTN } from "@/phaser/sim/input";
import { CRASH_PAUSE, GATE, HIT, KIND, METRE, PRESETS, RunnerSim, SHAPE, WARMUP, type Kind, type PresetId } from "@/phaser/sim/runner";
import { solveRun } from "@/phaser/sim/runner-bot";

const DIFFS = Object.keys(PRESETS) as PresetId[];
const sim = (d: PresetId = "easy", seed = 7, target?: number) => new RunnerSim({ preset: PRESETS[d], seed, target });

/** A sim on an empty track with only the given obstacles (px from the runner's start). */
function course(obs: [Kind, number, number?][]): RunnerSim {
  const s = sim();
  s.obs = obs.map(([k, x, w]) => ({ k, x: x * FP, w: (w ?? SHAPE[k].w) * FP, y: SHAPE[k].y * FP, h: SHAPE[k].h * FP }));
  s.nextX = 1e9;
  return s;
}
/** Steps `frames` with `b` held (or a per-frame function) and returns the highest the feet got, px. */
function run(s: RunnerSim, frames: number, b: number | ((f: number) => number) = 0): number {
  let top = 0;
  for (let f = 0; f < frames && !s.finished; f++) {
    s.step(typeof b === "number" ? b : b(f));
    top = Math.max(top, s.y / FP);
  }
  return top;
}

describe("runner sim", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = sim("hard", 42),
      b = sim("hard", 42),
      c = sim("hard", 43);
    for (let i = 0; i < 400; i++) [a, b, c].forEach((s) => s.step(i % 50 < 20 ? BTN.JUMP : 0));
    expect(a.obs).toEqual(b.obs);
    expect(a.frame).toBe(b.frame);
    expect(a.y).toBe(b.y);
    expect(JSON.stringify(a.obs)).not.toBe(JSON.stringify(c.obs));
  });

  it("runs on its own; a runner who never acts crashes on the first obstacle and the run ends", () => {
    for (const d of DIFFS) {
      const s = sim(d, 3);
      run(s, 5000);
      expect(s.finished, d).toBe(true);
      expect(s.deaths, d).toBe(1);
      expect(s.dist, d).toBeGreaterThan(WARMUP - 40 * FP);
      expect(s.score(), d).toBe(s.metres());
    }
  });

  it("speeds up with distance to a cap, faster presets start and top out higher", () => {
    for (const d of DIFFS) {
      const s = sim(d);
      expect(s.speedAt(0)).toBe(PRESETS[d].start);
      expect(s.speedAt(500 * METRE)).toBeGreaterThan(s.speedAt(100 * METRE));
      expect(s.speedAt(100_000 * METRE)).toBe(PRESETS[d].cap);
    }
    for (let i = 1; i < DIFFS.length; i++) {
      expect(PRESETS[DIFFS[i]].start).toBeGreaterThan(PRESETS[DIFFS[i - 1]].start);
      expect(PRESETS[DIFFS[i]].cap).toBeGreaterThan(PRESETS[DIFFS[i - 1]].cap);
    }
  });

  it("opens with crates and cones only, and brings gaps, drones, stacks and balloons as the speed climbs", () => {
    const seen = new Map<Kind, number>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = sim("easy", seed);
      const p = s as unknown as { dist: number; fill(): void };
      while (p.dist < 2000 * METRE) {
        for (const o of s.obs) {
          const v = s.speedAt(o.x);
          if (o.k !== KIND.CRATE && o.k !== KIND.CONE) expect(v, `kind ${o.k}`).toBeGreaterThanOrEqual(GATE.gaps);
          if (o.k === KIND.DRONE_HEAD) expect(v).toBeGreaterThanOrEqual(GATE.duck);
          if (o.k === KIND.STACK || o.k === KIND.DRONE_LOW) expect(v).toBeGreaterThanOrEqual(GATE.tall);
          if (o.k === KIND.BALLOON) expect(v).toBeGreaterThanOrEqual(GATE.mixed);
          if (!seen.has(o.k)) seen.set(o.k, o.x);
        }
        p.dist += 50 * FP;
        p.fill();
      }
    }
    for (const k of Object.values(KIND)) expect(seen.has(k), `kind ${k}`).toBe(true);
    // the first obstacle is a crate or a cone, after a clear warm-up stretch
    const s = sim("easy", 9);
    expect(s.obs[0].x).toBe(WARMUP);
    expect([KIND.CRATE, KIND.CONE]).toContain(s.obs[0].k);
  });

  it("jumps higher the longer JUMP is held; a press just before landing still jumps", () => {
    const tap = run(sim(), 60, (f) => (f < 2 ? BTN.JUMP : 0));
    const hold = run(sim(), 60, BTN.JUMP);
    expect(tap).toBeGreaterThan(20);
    expect(tap).toBeLessThan(30);
    expect(hold).toBeGreaterThan(44);
    expect(hold).toBeLessThan(52);
    // hold never re-jumps by itself on landing
    const s = sim();
    let jumps = 0;
    for (let f = 0; f < 120; f++) {
      s.step(BTN.JUMP);
      if (s.ev & EV.JUMP) jumps++;
    }
    expect(jumps).toBe(1);
    // buffered: press 4 frames before touching down
    const b = sim();
    b.step(BTN.JUMP);
    b.step(0);
    let land = 0;
    const probe = b.clone();
    for (let f = 0; f < 80 && !land; f++) {
      probe.step(0);
      if (probe.ev & EV.LAND) land = f;
    }
    let again = false;
    for (let f = 0; f < 80; f++) {
      b.step(f >= land - 4 && f < land - 2 ? BTN.JUMP : 0);
      if (f > land - 4 && b.ev & EV.JUMP) again = true;
    }
    expect(again).toBe(true);
  });

  it("ducks: a smaller hitbox on the ground, a fast fall in the air", () => {
    const s = sim();
    s.step(BTN.DOWN);
    expect(s.ducking).toBe(true);
    expect(s.hitbox().h).toBe(HIT.duck);
    s.step(0);
    expect(s.hitbox().h).toBe(HIT.stand);
    const air = (fast: boolean) => {
      const r = course([]);
      let f = 0;
      for (; f < 200; f++) {
        r.step(f < 10 ? BTN.JUMP : fast && f >= 12 ? BTN.DOWN : 0);
        if (f > 1 && r.onGround) break;
      }
      return f;
    };
    expect(air(true)).toBeLessThan(air(false) - 6);
  });

  it("clears each obstacle with the right move and crashes without it", () => {
    const at = 60;
    // crate: jump over, crash standing
    const jumpAt = (k: Kind, hold: number) => {
      const s = course([[k, at]]);
      // take off 24 px before the runner reaches the obstacle (2 px a frame)
      const lead = 12;
      run(s, 140, (f) => (f >= lead && f < lead + hold ? BTN.JUMP : 0));
      return s.deaths;
    };
    for (const k of [KIND.CRATE, KIND.CONE, KIND.HURDLE, KIND.DRONE_LOW]) {
      expect(jumpAt(k, 16), `jump ${k}`).toBe(0);
      const idle = course([[k, at]]);
      run(idle, 140);
      expect(idle.deaths, `idle ${k}`).toBe(1);
    }
    // tall stack: a tap is too low, a held jump clears it
    expect(jumpAt(KIND.STACK, 2)).toBe(1);
    expect(jumpAt(KIND.STACK, 16)).toBe(0);
    // head-height drone: duck under it
    const duck = course([[KIND.DRONE_HEAD, at]]);
    run(duck, 140, BTN.DOWN);
    expect(duck.deaths).toBe(0);
    const stand = course([[KIND.DRONE_HEAD, at]]);
    run(stand, 140);
    expect(stand.deaths).toBe(1);
    // high balloon: harmless standing, a big jump into it crashes
    const under = course([[KIND.BALLOON, at]]);
    run(under, 140);
    expect(under.deaths).toBe(0);
    expect(jumpAt(KIND.BALLOON, 16)).toBe(1);
    // gap: running into it falls, jumping clears it
    const fall = course([[KIND.GAP, at, 32]]);
    run(fall, 140);
    expect(fall.deaths).toBe(1);
    expect(fall.crashAt.k).toBe(KIND.GAP);
    expect(jumpAt(KIND.GAP, 16)).toBe(0);
  });

  it("levels: a crash restarts the same run after a pause; reaching the goal finishes it", () => {
    const s = sim("easy", 11, 120);
    const first = JSON.stringify(s.obs);
    const crashOnce = (r: RunnerSim) => {
      while (!r.deaths) r.step(0);
      expect(r.crashT).toBe(CRASH_PAUSE);
      while (r.crashT) r.step(0);
    };
    crashOnce(s);
    expect(s.finished).toBe(false);
    expect(s.deaths).toBe(1);
    expect(s.dist).toBe(0);
    expect(JSON.stringify(s.obs)).toBe(first);
    const r = sim("easy", 11, 120);
    crashOnce(r);
    const plan = solveRun(r, 1e9, 4);
    expect(plan).not.toBeNull();
    for (const b of plan!) r.step(b);
    expect(r.finished).toBe(true);
    expect(r.metres()).toBe(120);
    expect(r.deaths).toBe(1);
    expect(r.progress()).toBe(1);
  });

  it("clones independently (the bot and ghosts rely on it)", () => {
    const a = sim("medium", 5);
    run(a, 100, BTN.JUMP);
    const b = a.clone();
    run(b, 300);
    expect(a.frame).toBe(100);
    expect(b.frame).toBeGreaterThan(100);
    const c = a.clone();
    run(c, 300);
    expect(c.obs).toEqual(b.obs);
    expect(c.dist).toBe(b.dist);
  });

  // Fairness: every generated stretch can be passed by a player who decides only every 6 frames (100 ms).
  for (const d of DIFFS) {
    it(`every ${d} run is passable to 2000 m (40 seeds, 100 ms decisions)`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const r = solveRun(sim(d, seed * 7919), 2000, 6);
        expect(r, `${d} seed ${seed}`).not.toBeNull();
      }
    });
  }
});
