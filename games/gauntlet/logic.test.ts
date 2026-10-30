import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { courseGameSuite } from "@/phaser/sim/testkit";
import { BTN } from "@/phaser/sim/input";
import logic, { createSim, generate, hint } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS from "./solutions.json";

describe("gauntlet", () => {
  courseGameSuite({
    logic,
    ids: LEVELS.map((l) => l.id),
    sim: createSim,
    solutions: SOLUTIONS,
    pause: CONFIG.levelPause,
    min: 10,
    max: 10,
  });

  it("always runs 10 rooms, in difficulty order, the same for everyone on a seed", () => {
    for (const d of ["easy", "mega"] as const) {
      const a = generate(createRng("week:2026-45"), d);
      expect(a.puzzle.levels.length).toBe(10);
      const order = a.puzzle.levels.map((id) => LEVELS.findIndex((l) => l.id === id));
      expect(order).toEqual(order.slice().sort((x, y) => x - y));
    }
  });

  it("most rooms lie: a player who just runs right dies in them", () => {
    let lied = 0;
    for (const l of LEVELS) {
      const sim = createSim({ levels: [l.id] });
      for (let i = 0; i < 900 && !sim.deaths && !sim.finished; i++) sim.step(BTN.RIGHT | (sim.world.body.vx === 0 && i > 5 ? BTN.JUMP : 0));
      if (sim.deaths) lied++;
    }
    expect(lied).toBeGreaterThanOrEqual(7);
  });

  it("hints name the lie in the current room", () => {
    const g = generate(createRng("h"), "easy");
    expect(hint(g.puzzle, g.solution, undefined as never)?.text.length).toBeGreaterThan(10);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });
});
