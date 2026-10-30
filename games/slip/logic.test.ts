import { describe, expect, it } from "vitest";
import { courseGameSuite } from "@/phaser/sim/testkit";
import { BTN } from "@/phaser/sim/input";
import { EV } from "@/phaser/sim/core";
import logic, { createSim } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS from "./solutions.json";

describe("slip", () => {
  courseGameSuite({ logic, ids: LEVELS.map((l) => l.id), sim: createSim, solutions: SOLUTIONS, pause: CONFIG.levelPause });

  it("no tower can be climbed by jumping alone", () => {
    for (const l of LEVELS) {
      const sim = createSim({ levels: [l.id] });
      for (let i = 0; i < 1500 && !sim.finished; i++) sim.step(i % 30 === 0 ? BTN.JUMP | BTN.RIGHT : BTN.RIGHT);
      expect(sim.finished, l.id).toBe(false);
    }
  });

  it("grabs a hold on touch, swings with left and right, and lets go with a hop", () => {
    const sim = createSim({ levels: [LEVELS[0].id] });
    let grab = false;
    for (let i = 0; i < 200 && !grab; i++) {
      sim.step(i === 30 ? BTN.JUMP : sim.world.body.x < 4.4 * 4096 ? BTN.RIGHT : 0);
      if (sim.ev & EV.GRAB) grab = true;
    }
    expect(grab).toBe(true);
    for (let i = 0; i < 30; i++) sim.step(BTN.RIGHT);
    expect(sim.world.body.hook).toBeGreaterThanOrEqual(0);
    sim.step(0);
    sim.step(BTN.JUMP);
    expect(sim.world.body.hook).toBe(-1);
    expect(sim.world.body.vy).toBeLessThan(0);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });
});
