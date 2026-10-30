import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { replay, EV } from "@/phaser/sim/core";
import { BTN, logFromFrames } from "@/phaser/sim/input";
import { runState } from "@/phaser/sim/testkit";
import { PERFECT } from "@/phaser/sim/stacked";
import logic, { createSim, generate, progress, verify } from "./logic";
import { TOWER_FOR, TOWERS } from "./levels";
import { botFrames } from "./bot";

const play = (seed: string, d: Difficulty, miss = 6) => {
  const g = generate(createRng(seed), d);
  const frames = botFrames(createSim(g.puzzle), 60 * 60 * 10, Infinity, miss);
  return { g, frames, log: logFromFrames(frames) };
};

describe("stacked", () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a seeded ${d} tower that a scripted stacker can build and finish`, () => {
      const a = generate(createRng(`daily:${d}`), d);
      expect(generate(createRng(`daily:${d}`), d)).toEqual(a);
      expect(a.puzzle.levels).toEqual([TOWER_FOR[d]]);
      const { g, log } = play(`daily:${d}`, d);
      const r = replay(createSim(g.puzzle), log);
      expect(r.ok).toBe(true);
      expect(r.deaths).toBe(1);
      expect(r.score).toBeGreaterThanOrEqual(10);
    });
  }

  it("is deterministic, and seeds change the slide speeds", () => {
    const a = play("x", "hard");
    expect(play("x", "hard").frames).toEqual(a.frames);
    expect(replay(createSim(a.g.puzzle), a.log)).toEqual(replay(createSim(a.g.puzzle), a.log));
    const s1 = createSim({ levels: ["brisk"], seed: 1 });
    const s2 = createSim({ levels: ["brisk"], seed: 99 });
    expect([s1.v, s1.x]).not.toEqual([s2.v, s2.x]);
  });

  it("cuts overhangs, snaps perfect drops and ends on a miss", () => {
    const sim = createSim({ levels: ["steady"], seed: 3 });
    botFrames(sim, 5000, 3, 0);
    expect(sim.score()).toBe(3);
    expect(sim.tower[3].w).toBe(sim.tower[0].w);
    expect(sim.perfectStreak).toBe(3);
    // drop off-centre: overhang is cut
    while (Math.abs(sim.x - sim.tower[3].x) < 10 * 256 || Math.abs(sim.x - sim.tower[3].x) > 20 * 256) sim.step(0);
    sim.step(BTN.JUMP);
    expect(sim.ev & EV.CUT).toBeTruthy();
    expect(sim.tower[4].w).toBeLessThan(sim.tower[3].w);
    expect(sim.cut).not.toBeNull();
    sim.step(0);
    // drop while far away: a miss ends the run
    while (Math.abs(sim.x - sim.tower[4].x) <= sim.tower[4].w + PERFECT) sim.step(0);
    sim.step(BTN.JUMP);
    expect(sim.finished).toBe(true);
    expect(sim.deaths).toBe(1);
    expect(sim.clone().score()).toBe(4);
  });

  it("verifies the score and rejects forged score, deaths, time and logs", () => {
    const { g, log } = play("verify", "medium");
    const r = replay(createSim(g.puzzle), log);
    expect(verify(g.puzzle, g.solution, runState(log, 1, log.frames, r.score))).toEqual({ ok: true, progress: 1, score: r.score });
    expect(verify(g.puzzle, g.solution, runState(log, 1, log.frames, r.score + 3)).reason).toMatch(/score/);
    expect(verify(g.puzzle, g.solution, runState(log, 0, log.frames, r.score)).reason).toMatch(/deaths/);
    expect(verify(g.puzzle, g.solution, { ...runState(log, 1, log.frames, r.score), timeMs: 1 }).reason).toMatch(/time/);
    expect(verify(g.puzzle, g.solution, runState(logFromFrames([0, 0, 4]), 0, 3, 1)).ok).toBe(false);
    expect(verify({ levels: ["steady"], seed: g.puzzle.seed }, g.solution, runState(log, 1, log.frames, r.score)).ok).toBe(false);
    expect(progress(g.puzzle, g.solution, runState(log, 1, log.frames, r.score))).toBeGreaterThan(0.3);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
    expect(logic.id).toBe("stacked");
    expect(TOWERS.length).toBe(5);
  });
});
