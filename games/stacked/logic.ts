/**
 * Stacked: drop the sliding block; overhangs are cut, a clean drop snaps perfect, a miss ends the run.
 * One tower per difficulty (games/stacked/levels.ts), slide speeds seeded per Daily. Score = blocks placed.
 * verify() re-simulates the input log; the run must end on the miss (or the cap).
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { StackedSim } from "@/phaser/sim/stacked";
import { TOWER_FOR, TOWERS } from "./levels";

export type StackedPuzzle = CoursePuzzle;
export type StackedSolution = CourseSolution;
export type StackedState = RageState;

export function createSim(p: CoursePuzzle): StackedSim {
  const a = TOWERS.find((x) => x.id === p.levels[0]);
  if (!a || p.levels.length !== 1) throw new Error("stacked: unknown tower");
  return new StackedSim(a, p.seed ?? 1);
}

const logic = makeCourseLogic({
  id: "stacked",
  pool: TOWERS.map((a) => a.id),
  sim: createSim,
  scoring: "score",
  seeded: true,
  pick: (_rng, d) => [TOWER_FOR[d]],
});

export const { generate, verify, progress } = logic;
export default logic;
