import { describe, expect, it } from "vitest";
import { courseGameSuite } from "@/phaser/sim/testkit";
import { BTN } from "@/phaser/sim/input";
import { EV } from "@/phaser/sim/core";
import logic, { createSim } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS from "./solutions.json";

describe("grapple", () => {
  courseGameSuite({ logic, ids: LEVELS.map((l) => l.id), sim: createSim, solutions: SOLUTIONS, pause: CONFIG.levelPause });

  it("every level needs the hooks: running and jumping alone never makes it", () => {
    for (const l of LEVELS) {
      const sim = createSim({ levels: [l.id] });
      for (let i = 0; i < 2000 && !sim.deaths && !sim.finished; i++) sim.step(i % 40 < 3 ? BTN.JUMP : 0);
      expect(sim.finished, l.id).toBe(false);
    }
  });

  it("holding grabs the hook ahead and letting go keeps the swing's momentum", () => {
    const sim = createSim({ levels: [LEVELS[0].id] });
    let grabbed = -1;
    for (let i = 0; i < 200 && grabbed < 0; i++) {
      sim.step(i > 40 ? BTN.JUMP : 0);
      if (sim.ev & EV.GRAB) grabbed = i;
    }
    expect(grabbed).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) sim.step(BTN.JUMP);
    expect(sim.world.body.hook).toBeGreaterThanOrEqual(0);
    sim.step(0);
    expect(sim.world.body.hook).toBe(-1);
    expect(sim.world.body.vx).toBeGreaterThan(0);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });
});
