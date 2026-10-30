import { describe, expect, it } from "vitest";
import { courseGameSuite } from "@/phaser/sim/testkit";
import { buildGhost, RageController } from "@/phaser/controller";
import { BTN, framesFromLog } from "@/phaser/sim/input";
import { STEP_MS } from "@/phaser/sim/fixed";
import { courseLog } from "@/phaser/sim/scripted";
import { createRng } from "@/lib/rng";
import logic, { createSim, generate } from "./logic";
import { CONFIG, LEVELS } from "./levels";
import SOLUTIONS from "./solutions.json";

describe("ghosted", () => {
  courseGameSuite({ logic, ids: LEVELS.map((l) => l.id), sim: createSim, solutions: SOLUTIONS, pause: CONFIG.levelPause, max: 5 });

  it("replays a friend's log as a ghost that moves exactly like the original run", () => {
    const g = generate(createRng("race"), "medium");
    const log = courseLog(g.puzzle.levels, SOLUTIONS, CONFIG.levelPause);
    const ghost = buildGhost("Kofi", () => createSim(g.puzzle), log);
    expect(ghost.curve[log.frames]).toBe(1);
    const solo = createSim(g.puzzle);
    const frames = framesFromLog(log);
    // the racer copies the ghost frame for frame: always level
    const race = new RageController(createSim(g.puzzle));
    race.setGhost(ghost);
    race.setSource("key", frames[0] || BTN.RIGHT);
    for (let f = 0; f < 200; f++) {
      race.setSource("key", frames[f]);
      race.tick(STEP_MS);
      solo.step(frames[f]);
      expect(race.ghost!.sim.world.body).toEqual(solo.world.body);
    }
    expect(Math.abs(race.ghostDelta()!)).toBeLessThan(0.05);
    // stand still: the ghost pulls ahead
    race.setSource("key", 0);
    for (let f = 0; f < 120; f++) race.tick(STEP_MS);
    expect(race.ghostDelta()!).toBeGreaterThan(1);
    expect(() => createSim({ levels: ["nope"] })).toThrow();
  });
});
