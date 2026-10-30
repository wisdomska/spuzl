/**
 * Gauntlet: 10 tiny troll rooms in a row (games/gauntlet/levels.ts), the same 10 for everyone, picked
 * by seed in difficulty order (the scheduler changes the seed weekly). verify() re-simulates the log on the shared
 * fixed-step sim (phaser/sim) and rejects any deaths or time that do not match. Fewest deaths, then time.
 */
import type { Difficulty } from "@/games/types";
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS } from "./levels";

export type GauntletPuzzle = CoursePuzzle;
export type GauntletSolution = CourseSolution;
export type GauntletState = RageState;

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

/** Fresh simulation for a course (the Board renders this same object). */
export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`gauntlet: unknown room ${id}`);
      return l;
    }),
    CONFIG,
  );
}

/** Always 10 rooms, whatever the day. */
export const GAUNTLET_LENGTH: Record<Difficulty, number> = { easy: 10, medium: 10, hard: 10, expert: 10, mega: 10 };

const logic = makeCourseLogic({
  id: "gauntlet",
  lengths: GAUNTLET_LENGTH,
  pool: LEVELS.map((l) => l.id),
  sim: createSim,
  scoring: "deaths",
  hint: (p, level) => PlatformerCourse.trapHint(createSim(p).levels[level]),
});

export const { generate, verify, progress } = logic;
export const hint = logic.hint!;
export default logic;
