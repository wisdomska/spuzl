/**
 * Gotcha: troll platformer, Level Devil style. A course is 3 to 5 rooms from the ladder (games/gotcha/levels.ts) picked
 * by seed, in difficulty order. The player submits an input log; verify() re-simulates it on the shared
 * fixed-step sim (phaser/sim) and rejects any deaths or time that do not match. Fewest deaths, then time.
 * Levels mode plays the ladder (LEVELS: long Level Devil-style generated rooms) one room per level.
 */
import { ladderPick, makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEVELS, ROOMS } from "./levels";

export type GotchaPuzzle = CoursePuzzle;
export type GotchaSolution = CourseSolution;
export type GotchaState = RageState;

const BY_ID = new Map(ROOMS.map((l) => [l.id, l]));

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

/** Ladder rooms are long (70 to 150 tiles), so a course strings fewer of them than the shorter games do. */
const LENGTHS = { easy: 3, medium: 3, hard: 4, expert: 4, mega: 5 } as const;

const logic = makeCourseLogic({
  id: "gotcha",
  lengths: LENGTHS,
  // Free play draws from the whole ladder, in a window that matches the difficulty (phaser/sim/course.ts).
  pool: LEVELS.map((l) => l.id),
  pick: ladderPick(
    LEVELS.map((l) => l.id),
    LENGTHS,
  ),
  ladder: LEVELS.map((l) => l.id),
  sim: createSim,
  scoring: "deaths",
  hint: (p, level) => PlatformerCourse.trapHint(createSim(p).levels[level]),
});

export const { generate, verify, progress } = logic;
export const hint = logic.hint!;
export default logic;
