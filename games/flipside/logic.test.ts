import { describe, expect, it } from "vitest";
import { courseGameSuite } from "@/phaser/sim/testkit";
import { BTN } from "@/phaser/sim/input";
import { EV } from "@/phaser/sim/core";
import logic, { createSim } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS from "./solutions.json";

describe("flipside", () => {
  courseGameSuite({ logic, ids: LEVELS.map((l) => l.id), sim: createSim, solutions: SOLUTIONS, pause: CONFIG.levelPause });

  it("a runner who never flips dies in every room", () => {
    for (const l of LEVELS) {
      const sim = createSim({ levels: [l.id] });
      for (let i = 0; i < 2000 && !sim.deaths && !sim.finished; i++) sim.step(0);
      expect(sim.deaths, l.id).toBe(1);
    }
  });

  it("a tap flips gravity only while touching the floor or the ceiling", () => {
    const sim = createSim({ levels: [LEVELS[0].id] });
    sim.step(0);
    sim.step(BTN.JUMP);
    expect(sim.ev & EV.FLIP).toBeTruthy();
    expect(sim.world.body.g).toBe(-1);
    sim.step(0);
    sim.step(BTN.JUMP); // mid-air: ignored
    expect(sim.world.body.g).toBe(-1);
    for (let i = 0; i < 30; i++) sim.step(0);
    expect(sim.world.body.grounded).toBe(true);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });
});
