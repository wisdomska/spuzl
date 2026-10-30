import { describe, expect, it } from "vitest";
import { courseGameSuite } from "@/phaser/sim/testkit";
import { BTN } from "@/phaser/sim/input";
import logic, { createSim } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS from "./solutions.json";

describe("dash", () => {
  courseGameSuite({ logic, ids: LEVELS.map((l) => l.id), sim: createSim, solutions: SOLUTIONS, pause: CONFIG.levelPause });

  it("runs on its own, and a runner who never jumps dies on every segment", () => {
    for (const l of LEVELS) {
      const sim = createSim({ levels: [l.id] });
      for (let i = 0; i < 2000 && !sim.deaths && !sim.finished; i++) sim.step(0);
      expect(sim.deaths, l.id).toBe(1);
    }
  });

  it("measures metres and course progress for the HUD", () => {
    const sim = createSim({ levels: [LEVELS[0].id, LEVELS[1].id] });
    for (let i = 0; i < 60; i++) sim.step(i === 40 ? BTN.JUMP : 0);
    expect(sim.metres()).toBeGreaterThan(5);
    expect(sim.progress()).toBeGreaterThan(0);
    expect(sim.progress()).toBeLessThan(0.5);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });
});
