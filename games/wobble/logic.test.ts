import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { replay, EV } from "@/phaser/sim/core";
import { BTN, framesFromLog, logFromFrames } from "@/phaser/sim/input";
import { runState } from "@/phaser/sim/testkit";
import { LEAN_LIMIT, WOBBLE_RESPAWN, gustsFor } from "@/phaser/sim/wobble";
import logic, { createSim, generate, hint, progress, verify } from "./logic";
import { ROPES } from "./levels";
import { botFrames } from "./bot";

describe("wobble", () => {
  it("every span is completable without a fall (scripted balancer, 20 seeds each)", () => {
    for (const r of ROPES)
      for (let s = 1; s <= 20; s++) {
        const log = logFromFrames(botFrames(createSim({ levels: [r.id], seed: s })));
        const res = replay(createSim({ levels: [r.id], seed: s }), log);
        expect(res.ok, `${r.id}:${s}`).toBe(true);
        expect(res.deaths, `${r.id}:${s}`).toBe(0);
      }
  });

  it("a walker left alone falls on every span", () => {
    for (const r of ROPES.slice(1)) {
      const sim = createSim({ levels: [r.id], seed: 3 });
      for (let i = 0; i < 3000 && !sim.deaths && !sim.finished; i++) sim.step(0);
      expect(sim.deaths, r.id).toBe(1);
    }
  });

  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a deterministic ${d} course of 3 to 8 spans, gentlest first`, () => {
      const a = generate(createRng(`daily:${d}`), d);
      expect(generate(createRng(`daily:${d}`), d)).toEqual(a);
      expect(a.puzzle.levels.length).toBeGreaterThanOrEqual(3);
      expect(a.puzzle.levels.length).toBeLessThanOrEqual(8);
      const order = a.puzzle.levels.map((id) => ROPES.findIndex((r) => r.id === id));
      expect(order).toEqual(order.slice().sort((x, y) => x - y));
      expect(a.puzzle.seed).toBeGreaterThan(0);
    });
  }

  it("re-simulates deterministically, verifies real runs and rejects forgeries", () => {
    const g = generate(createRng("verify"), "hard");
    const frames = botFrames(createSim(g.puzzle));
    const log = logFromFrames(frames);
    const r = replay(createSim(g.puzzle), log);
    expect(replay(createSim(g.puzzle), log)).toEqual(r);
    expect(verify(g.puzzle, g.solution, runState(log, 0, log.frames)).ok).toBe(true);
    expect(verify(g.puzzle, g.solution, runState(log, 2, log.frames)).reason).toMatch(/deaths/);
    expect(verify(g.puzzle, g.solution, { ...runState(log, 0, log.frames), timeMs: 10 }).reason).toMatch(/time/);
    const lazy = framesFromLog(log).map((b, i) => (i < 400 ? 0 : b));
    expect(verify(g.puzzle, g.solution, runState(logFromFrames(lazy), 0, lazy.length)).ok).toBe(false);
    expect(verify({ ...g.puzzle, seed: (g.puzzle.seed ?? 0) + 1 }, g.solution, runState(log, 0, log.frames)).reason).toMatch(/course/);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    expect(progress(g.puzzle, g.solution, runState(log, 0, log.frames))).toBe(1);
    expect(logic.id).toBe("wobble");
  });

  it("falls past the limit, respawns with the same wind and counts the fall", () => {
    const sim = createSim({ levels: [ROPES[4].id, ROPES[5].id], seed: 9 });
    let ev = 0;
    while (!sim.deaths) {
      sim.step(BTN.RIGHT);
      ev |= sim.ev;
    }
    expect(ev & EV.DEATH).toBeTruthy();
    expect(Math.abs(sim.lean)).toBeGreaterThan(LEAN_LIMIT);
    for (let i = 0; i < WOBBLE_RESPAWN; i++) sim.step(0);
    expect(sim.ev & EV.RESPAWN).toBeTruthy();
    expect(sim.pos).toBe(0);
    expect(sim.wind(gustsFor(ROPES[4], 9, 0)[0].at)).not.toBe(0);
    while (sim.cleared() < 1) sim.step(sim.lean + sim.spin * 6 > 20 ? BTN.LEFT : sim.lean + sim.spin * 6 < -20 ? BTN.RIGHT : 0);
    expect(sim.progress()).toBeGreaterThanOrEqual(0.5);
    expect(sim.metres()).toBeGreaterThan(0);
    expect(sim.clone().cleared()).toBe(1);
    expect(sim.score()).toBe(0);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });

  it("hints name the first gust without solving anything", () => {
    const g = generate(createRng("hint"), "medium");
    const h = hint(g.puzzle, g.solution, undefined as never);
    expect(h?.target).toEqual({ level: 0 });
    expect(h?.text).toMatch(/gust|No gusts/);
  });
});
