/**
 * Flipside: Spuz runs right on its own and every tap flips gravity. A Daily course strings 3 to 8
 * hand-designed rooms (games/flipside/levels.ts), easier first. A spike, a pit, a hole in the roof or a
 * wall face restarts the room. verify() re-simulates the input log. Fewest deaths, then time.
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS } from "./levels";

export type FlipsidePuzzle = CoursePuzzle;
export type FlipsideSolution = CourseSolution;
export type FlipsideState = RageState;

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`flipside: unknown room ${id}`);
      return l;
    }),
    CONFIG,
  );
}

const logic = makeCourseLogic({ id: "flipside", pool: LEVELS.map((l) => l.id), sim: createSim, scoring: "deaths" });

export const { generate, verify, progress } = logic;
export default logic;
