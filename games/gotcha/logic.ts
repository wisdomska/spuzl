/**
 * Gotcha: troll platformer. A Daily course is 3 to 8 hand-designed rooms (games/gotcha/levels.ts) picked
 * by seed, in difficulty order. The player submits an input log; verify() re-simulates it on the shared
 * fixed-step sim (phaser/sim) and rejects any deaths or time that do not match. Fewest deaths, then time.
 * Levels mode plays the whole ladder (LEVELS: hand rooms, set pieces, generated rooms) one room per level.
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, DAILY_POOL, LEVELS } from "./levels";

export type GotchaPuzzle = CoursePuzzle;
export type GotchaSolution = CourseSolution;
export type GotchaState = RageState;

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

/** Fresh simulation for a course (the Board renders this same object). */
export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`gotcha: unknown level ${id}`);
      return l;
    }),
    CONFIG,
  );
}

const logic = makeCourseLogic({
  id: "gotcha",
  pool: DAILY_POOL,
  ladder: LEVELS.map((l) => l.id),
  sim: createSim,
  scoring: "deaths",
  hint: (p, level) => PlatformerCourse.trapHint(createSim(p).levels[level]),
});

export const { generate, verify, progress } = logic;
export const hint = logic.hint!;
export default logic;
