/**
 * Wobble: keep the tightrope walker balanced to the end of each span. A Daily course is 3 to 8
 * hand-designed spans (games/wobble/levels.ts), gentlest first, with seeded gusts. verify() re-simulates
 * the input log and rejects mismatching deaths or time. Fewest falls, then time.
 */
import { makeCourseLogic, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { WobbleSim } from "@/phaser/sim/wobble";
import { ROPES } from "./levels";

export type WobblePuzzle = CoursePuzzle;
export type WobbleSolution = CourseSolution;
export type WobbleState = RageState;

const BY_ID = new Map(ROPES.map((r) => [r.id, r]));

export function createSim(p: CoursePuzzle): WobbleSim {
  return new WobbleSim(
    p.levels.map((id) => {
      const r = BY_ID.get(id);
      if (!r) throw new Error(`wobble: unknown rope ${id}`);
      return r;
    }),
    p.seed ?? 1,
  );
}

const logic = makeCourseLogic({
  id: "wobble",
  pool: ROPES.map((r) => r.id),
  sim: createSim,
  scoring: "deaths",
  seeded: true,
  hint: (p, level) => {
    const sim = createSim(p);
    const g = sim.gusts[level];
    if (!g.length) return "No gusts on this span. Small taps keep Spuz upright.";
    const first = g[0];
    return `First gust comes from the ${first.force > 0 ? "left" : "right"} about ${Math.max(1, Math.round(first.at / 60))} s in. Lean into it early.`;
  },
});

export const { generate, verify, progress } = logic;
export const hint = logic.hint!;
export default logic;
