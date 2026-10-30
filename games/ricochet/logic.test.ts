import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { replay, EV } from "@/phaser/sim/core";
import { logFromFrames, BTN } from "@/phaser/sim/input";
import { runState } from "@/phaser/sim/testkit";
import { RICOCHET_MAX_FRAMES } from "@/phaser/sim/ricochet";
import logic, { createSim, generate, progress, verify } from "./logic";
import { ARENA_FOR, ARENAS } from "./levels";
import { botFrames } from "./bot";

const play = (seed: string, d: Difficulty) => {
  const g = generate(createRng(seed), d);
  const frames = botFrames(createSim(g.puzzle), 60 * 60 * 3);
  return { g, frames, log: logFromFrames(frames) };
};

describe("ricochet", () => {
  for (const d of ["easy", "medium", "hard", "expert", "mega"] as Difficulty[]) {
    it(`generates a seeded ${d} arena and a scripted player scores in it`, () => {
      const a = generate(createRng(`daily:${d}`), d);
      expect(generate(createRng(`daily:${d}`), d)).toEqual(a);
      expect(a.puzzle.levels).toEqual([ARENA_FOR[d]]);
      expect(a.puzzle.seed).toBeGreaterThan(0);
      const { g, log } = play(`daily:${d}`, d);
      const r = replay(createSim(g.puzzle), log);
      expect(r.ok).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(5);
    });
  }

  it("is deterministic and different seeds give different walls", () => {
    const a = play("x", "medium");
    const b = play("x", "medium");
    expect(a.frames).toEqual(b.frames);
    expect(replay(createSim(a.g.puzzle), a.log)).toEqual(replay(createSim(b.g.puzzle), b.log));
    const s1 = createSim({ levels: ["standard"], seed: 1 });
    const s2 = createSim({ levels: ["standard"], seed: 2 });
    expect(s1.walls[1]).not.toEqual(s2.walls[1]);
  });

  it("verifies the score and rejects forged score, deaths, time and logs", () => {
    const { g, log } = play("verify", "hard");
    const r = replay(createSim(g.puzzle), log);
    const ok = verify(g.puzzle, g.solution, runState(log, r.deaths, log.frames, r.score));
    expect(ok).toEqual({ ok: true, progress: 1, score: r.score });
    expect(verify(g.puzzle, g.solution, runState(log, r.deaths, log.frames, r.score + 1)).reason).toMatch(/score/);
    expect(verify(g.puzzle, g.solution, runState(log, 0, log.frames, r.score)).reason).toMatch(/deaths/);
    expect(verify(g.puzzle, g.solution, { ...runState(log, r.deaths, log.frames, r.score), timeMs: 5 }).reason).toMatch(/time/);
    const cut = logFromFrames(new Array(30).fill(0));
    const p = verify(g.puzzle, g.solution, runState(cut, 0, 30, 0));
    expect(p.ok).toBe(false);
    expect(verify({ levels: ["calm"], seed: g.puzzle.seed }, g.solution, runState(log, 1, log.frames, r.score)).reason).toMatch(/course/);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    expect(progress(g.puzzle, g.solution, runState(log, 1, log.frames, r.score))).toBeGreaterThan(0);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
    expect(logic.id).toBe("ricochet");
  });

  it("bounces score, speed rises, spikes and the floor kill", () => {
    const sim = createSim({ levels: ["calm"], seed: 5 });
    const v0 = Math.abs(sim.vx);
    const frames = botFrames(sim, 60 * 60, 8);
    expect(frames.length).toBeGreaterThan(0);
    expect(sim.score()).toBe(8);
    expect(Math.abs(sim.vx)).toBeGreaterThan(v0);
    expect(sim.walls.flat().filter(Boolean).length).toBeGreaterThanOrEqual(2);
    const drop = createSim({ levels: ["calm"], seed: 5 });
    let ev = 0;
    while (!drop.finished) {
      drop.step(0);
      ev |= drop.ev;
    }
    expect(ev & EV.DEATH).toBeTruthy();
    expect(drop.deaths).toBe(1);
    drop.step(BTN.JUMP);
    expect(drop.frame).toBeLessThan(RICOCHET_MAX_FRAMES);
    expect(ARENAS.length).toBe(5);
    expect(drop.clone().score()).toBe(drop.score());
  });
});
