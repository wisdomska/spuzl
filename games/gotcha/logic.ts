/**
 * Gotcha: troll platformer. A course is 4 to 8 one-screen rooms from the ladder (games/gotcha/rooms.ts) picked
 * by seed, in difficulty order. The player submits an input log; verify() re-simulates it on the shared
 * fixed-step sim (phaser/sim) and rejects any deaths or time that do not match. Fewest deaths, then time.
 * Levels mode plays the ladder one room per level. Rooms from before the rebuild (LEGACY_ROOMS) stay known, so a
 * course scheduled earlier still verifies.
 */
import { ladderPick, makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { PlatformerCourse } from "@/phaser/sim/platformer";
import { CONFIG, LEGACY_CONFIG, LEGACY_ROOMS, LEVELS, ROOMS } from "./levels";

export type GotchaPuzzle = CoursePuzzle;
export type GotchaSolution = CourseSolution;
export type GotchaState = RageState;

const BY_ID = new Map(ROOMS.map((l) => [l.id, l]));
const LEGACY_IDS = new Set(LEGACY_ROOMS.map((l) => l.id));

/** Fresh simulation for a course (the Board renders this same object). */
export function createSim(p: CoursePuzzle): PlatformerCourse {
  return new PlatformerCourse(
    p.levels.map((id) => {
      const l = BY_ID.get(id);
      if (!l) throw new Error(`gotcha: unknown level ${id}`);
      return l;
    }),
    // a course scheduled before the rebuild (legacy rooms only) plays on the physics it was scripted for
    p.levels.length && p.levels.every((id) => LEGACY_IDS.has(id)) ? LEGACY_CONFIG : CONFIG,
  );
}

/** Rooms are one screen each (10 to 30 seconds once known), so a course strings a handful. */
const LENGTHS = { easy: 4, medium: 5, hard: 6, expert: 7, mega: 8 } as const;

const logic = makeCourseLogic({
  id: "gotcha",
  lengths: LENGTHS,
  // Free play draws from the whole ladder, in a window that matches the difficulty (phaser/sim/course.ts). Legacy rooms
  // sit after the ladder in the pool only so old scheduled courses still count as known; no new course picks them.
  pool: [...LEVELS, ...LEGACY_ROOMS].map((l) => l.id),
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
