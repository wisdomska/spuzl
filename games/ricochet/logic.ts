/**
 * Ricochet: bounce wall to wall and dodge the seeded spikes as the speed rises. One arena per difficulty
 * (games/ricochet/levels.ts), spike patterns seeded per Daily. Score = wall touches. verify() re-simulates
 * the input log and the run must end on the frame of the hit (or the 10 minute cap).
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { RicochetSim } from "@/phaser/sim/ricochet";
import { ARENA_FOR, ARENAS } from "./levels";

export type RicochetPuzzle = CoursePuzzle;
export type RicochetSolution = CourseSolution;
export type RicochetState = RageState;

export function createSim(p: CoursePuzzle): RicochetSim {
  const a = ARENAS.find((x) => x.id === p.levels[0]);
  if (!a || p.levels.length !== 1) throw new Error("ricochet: unknown arena");
  return new RicochetSim(a, p.seed ?? 1);
}

const logic = makeCourseLogic({
  id: "ricochet",
  pool: ARENAS.map((a) => a.id),
  sim: createSim,
  scoring: "score",
  seeded: true,
  pick: (_rng, d) => [ARENA_FOR[d]],
});

export const { generate, verify, progress } = logic;
export default logic;
