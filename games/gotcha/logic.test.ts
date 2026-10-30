import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty, InputLog } from "@/games/types";
import { BTN, framesFromLog, logFromFrames } from "@/phaser/sim/input";
import { replay } from "@/phaser/sim/core";
import { framesToMs } from "@/phaser/sim/fixed";
import { courseLog } from "@/phaser/sim/scripted";
import { EV } from "@/phaser/sim/core";
import logic, { createSim, generate, hint, progress, verify } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS_JSON from "./solutions.json";

const SOLUTIONS: Record<string, number[][]> = SOLUTIONS_JSON;

const state = (log: InputLog, deaths: number, frames: number) => ({ log, deaths, timeMs: framesToMs(frames) });

/** Walks right into the first trap until one death, waits for the respawn, then plays the solution. */
function logWithOneDeath(levels: string[]): { log: InputLog; frames: number } {
  const sim = createSim({ levels });
  const frames: number[] = [];
  while (sim.deaths === 0) {
    sim.step(BTN.RIGHT);
    frames.push(BTN.RIGHT);
    if (frames.length > 3000) throw new Error("never died");
  }
  while (!(sim.ev & EV.RESPAWN)) {
    sim.step(0);
    frames.push(0);
  }
  const rest = framesFromLog(courseLog(levels, SOLUTIONS, CONFIG.levelPause));
  const log = logFromFrames([...frames, ...rest]);
  return { log, frames: log.frames };
}

describe("gotcha", () => {
  it("has a scripted no-death solution for every level, and each one finishes", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(10);
    for (const l of LEVELS) {
      const log = courseLog([l.id], SOLUTIONS, CONFIG.levelPause);
      const r = replay(createSim({ levels: [l.id] }), log);
      expect(r.ok, l.id).toBe(true);
      expect(r.deaths, l.id).toBe(0);
    }
  });

  it("every trap room kills a player who just runs right (the lie works the first time)", () => {
    for (const id of ["trust-fall", "pop-up", "fake-floor", "hop-hop", "cliffhanger"]) {
      const sim = createSim({ levels: [id] });
      // run right and hop only when a wall stops the runner
      for (let i = 0; i < 1200 && !sim.deaths; i++) sim.step(BTN.RIGHT | (sim.world.body.vx === 0 && i > 5 ? BTN.JUMP : 0));
      expect(sim.deaths, id).toBeGreaterThan(0);
    }
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic ${d} course of 3 to 10 known rooms`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.levels.length).toBeGreaterThanOrEqual(3);
      expect(a.puzzle.levels.length).toBeLessThanOrEqual(10);
      expect(new Set(a.puzzle.levels).size).toBe(a.puzzle.levels.length);
      expect(a.grade).toBeGreaterThanOrEqual(0);
      expect(a.grade).toBeLessThanOrEqual(100);
      const order = a.puzzle.levels.map((id) => LEVELS.findIndex((l) => l.id === id));
      expect(order).toEqual(order.slice().sort((x, y) => x - y));
    });
  }

  it("courses get longer and harder across difficulties", () => {
    const g = (d: Difficulty) => generate(createRng("grade"), d);
    expect(g("easy").puzzle.levels.length).toBeLessThan(g("hard").puzzle.levels.length);
    expect(g("easy").grade).toBeLessThan(g("mega").grade);
  });

  it("verifies a full scripted course and is deterministic", () => {
    for (let i = 0; i < 20; i++) {
      const g = generate(createRng(`seed:${i}`), "hard");
      const log = courseLog(g.puzzle.levels, SOLUTIONS, CONFIG.levelPause);
      const a = replay(createSim(g.puzzle), log);
      const b = replay(createSim(g.puzzle), log);
      expect(a).toEqual(b);
      const v = verify(g.puzzle, g.solution, state(log, 0, log.frames));
      expect(v.ok).toBe(true);
      expect(v.progress).toBe(1);
      expect(v.score).toBeGreaterThan(0);
    }
  });

  it("counts deaths, scores fewer deaths higher, and rejects forged deaths or time", () => {
    const g = generate(createRng("deaths"), "easy");
    const clean = courseLog(g.puzzle.levels, SOLUTIONS, CONFIG.levelPause);
    const { log, frames } = logWithOneDeath(g.puzzle.levels);
    const ok = verify(g.puzzle, g.solution, state(log, 1, frames));
    expect(ok.ok).toBe(true);
    const best = verify(g.puzzle, g.solution, state(clean, 0, clean.frames));
    expect(best.score!).toBeGreaterThan(ok.score!);
    expect(verify(g.puzzle, g.solution, state(log, 0, frames)).reason).toMatch(/deaths/);
    expect(verify(g.puzzle, g.solution, { log, deaths: 1, timeMs: framesToMs(frames) - 500 }).reason).toMatch(/time/);
  });

  it("rejects tampered, unfinished and malformed logs", () => {
    const g = generate(createRng("tamper"), "medium");
    const log = courseLog(g.puzzle.levels, SOLUTIONS, CONFIG.levelPause);
    // flip one input mid-run: the runner dies or misses the finish frame
    const frames = framesFromLog(log);
    const k = frames.findIndex((b, i) => i > 30 && b & BTN.JUMP);
    frames.splice(k, 4, 0, 0, 0, 0);
    const tampered = logFromFrames(frames);
    expect(verify(g.puzzle, g.solution, state(tampered, 0, tampered.frames)).ok).toBe(false);
    // cut short
    const short = { ...log, frames: log.frames - 40, events: log.events.filter((e) => e[0] < log.frames - 40) };
    const r = verify(g.puzzle, g.solution, state(short, 0, short.frames));
    expect(r.ok).toBe(false);
    expect(r.progress).toBeLessThan(1);
    // padded after the finish
    const long = { ...log, frames: log.frames + 10 };
    expect(verify(g.puzzle, g.solution, state(long, 0, long.frames)).reason).toMatch(/after the finish/);
    // malformed
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { log: { step: 10, events: [], frames: 5 }, deaths: 0, timeMs: 83 }).reason).toBe("bad step");
    expect(
      verify(
        g.puzzle,
        g.solution,
        state(
          {
            ...log,
            events: [
              [5, 1],
              [3, 2],
            ],
          },
          0,
          log.frames,
        ),
      ).ok,
    ).toBe(false);
    expect(verify(g.puzzle, g.solution, state({ ...log, events: [[0, 99]] }, 0, log.frames)).ok).toBe(false);
    // a different course than the scheduled one
    const other = { levels: [LEVELS[0].id, LEVELS[1].id, LEVELS[2].id, LEVELS[3].id] };
    expect(verify(other, g.solution, state(log, 0, log.frames)).reason).toMatch(/course/);
  });

  it("reports server progress for partial runs without leaking anything", () => {
    const g = generate(createRng("progress"), "medium");
    const full = courseLog(g.puzzle.levels, SOLUTIONS, CONFIG.levelPause);
    const firstOnly = courseLog(g.puzzle.levels.slice(0, 1), SOLUTIONS, CONFIG.levelPause);
    expect(progress(g.puzzle, g.solution, state(full, 0, full.frames))).toBe(1);
    expect(progress(g.puzzle, g.solution, state(firstOnly, 0, firstOnly.frames))).toBeCloseTo(1 / g.puzzle.levels.length);
    expect(progress(g.puzzle, g.solution, null as never)).toBe(0);
    expect(logic.id).toBe("gotcha");
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });

  it("hints warn about the current room's trap without solving it", () => {
    const g = generate(createRng("hint"), "medium");
    const h0 = hint(g.puzzle, g.solution, undefined as never);
    expect(h0?.target).toEqual({ level: 0 });
    expect(h0?.text).not.toMatch(/[\u2013\u2014]/);
    const first = courseLog(g.puzzle.levels.slice(0, 1), SOLUTIONS, CONFIG.levelPause);
    const h1 = hint(g.puzzle, g.solution, state(first, 0, first.frames));
    expect(h1?.target).toEqual({ level: 1 });
    const full = courseLog(g.puzzle.levels, SOLUTIONS, CONFIG.levelPause);
    expect(hint(g.puzzle, g.solution, state(full, 0, full.frames))).toBeNull();
    expect(hint({ levels: ["x"] }, g.solution, state(full, 0, full.frames))).toBeNull();
    const texts = new Set(LEVELS.map((l) => hint({ levels: [l.id] }, { levels: [l.id] }, undefined as never)?.text));
    expect(texts.size).toBeGreaterThanOrEqual(3);
  });
});
