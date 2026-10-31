/**
 * Slip: climb the tower. Spuz grabs any hold it touches; swing with left and right, let go to hop. A
 * Daily course is 3 to 8 hand-designed towers (games/slip/levels.ts), lowest first. Spikes restart the
 * tower. verify() re-simulates the input log. Fewest deaths, then time.
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS } from "./levels";

export type SlipPuzzle = CoursePuzzle;
export type SlipSolution = CourseSolution;
export type SlipState = RageState;

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`slip: unknown tower ${id}`);
      return l;
    }),
    CONFIG,
  );
}

const logic = makeCourseLogic({ id: "slip", pool: LEVELS.map((l) => l.id), sim: createSim, scoring: "deaths" });

export const { generate, verify, progress } = logic;
export default logic;
