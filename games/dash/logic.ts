/**
 * Dash: auto-runner. Spuz runs right on its own; tap to jump. A Daily course strings 3 to 8
 * hand-designed segments (games/dash/levels.ts) in a seeded order. Hitting a spike, a wall face or a
 * pit restarts the segment. verify() re-simulates the input log. Fewest deaths, then time.
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS } from "./levels";

export type DashPuzzle = CoursePuzzle;
export type DashSolution = CourseSolution;
export type DashState = RageState;

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`dash: unknown segment ${id}`);
      return l;
    }),
    CONFIG,
  );
}

const logic = makeCourseLogic({ id: "dash", pool: LEVELS.map((l) => l.id), sim: createSim, scoring: "deaths", ramp: false });

export const { generate, verify, progress } = logic;
export default logic;
