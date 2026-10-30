/**
 * Grapple: Spuz runs on its own; hold to hang from a hook, let go to fly. A Daily course strings 3 to 8
 * hand-designed swings (games/grapple/levels.ts), easier first. The spikes in the pits and on the roof
 * restart the level. verify() re-simulates the input log. Fewest deaths, then time.
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS } from "./levels";

export type GrapplePuzzle = CoursePuzzle;
export type GrappleSolution = CourseSolution;
export type GrappleState = RageState;

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`grapple: unknown level ${id}`);
      return l;
    }),
    CONFIG,
  );
}

const logic = makeCourseLogic({ id: "grapple", pool: LEVELS.map((l) => l.id), sim: createSim, scoring: "deaths" });

export const { generate, verify, progress } = logic;
export default logic;
