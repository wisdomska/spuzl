/**
 * Ghosted: race a friend's best-run ghost on today's track. A Daily course is 3 to 5 hand-designed
 * tracks (games/ghosted/levels.ts) picked by seed. The ghost is just another input log replayed through
 * the same deterministic sim, so it moves exactly as the friend did. verify() re-simulates the log.
 * Fewest deaths, then time.
 */
import type { Difficulty } from "@/games/types";
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS } from "./levels";

export type GhostedPuzzle = CoursePuzzle;
export type GhostedSolution = CourseSolution;
export type GhostedState = RageState;

export const TRACK_LENGTH: Record<Difficulty, number> = { easy: 3, medium: 3, hard: 4, expert: 4, mega: 5 };

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`ghosted: unknown track ${id}`);
      return l;
    }),
    CONFIG,
  );
}

const logic = makeCourseLogic({
  id: "ghosted",
  pool: LEVELS.map((l) => l.id),
  sim: createSim,
  scoring: "deaths",
  lengths: TRACK_LENGTH,
  ramp: false,
});

export const { generate, verify, progress } = logic;
export default logic;
