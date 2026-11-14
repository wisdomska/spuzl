/**
 * Dash runs. Free play (and Ghost Race) is an endless run at the difficulty's speed preset with a seeded obstacle
 * stream: `run-<difficulty>` plus the puzzle's seed. Levels mode is a ladder of fixed runs with a distance to
 * reach: each level has its own seed (the same obstacles for everyone, and on every retry), a speed preset that
 * climbs every six levels, and a target that grows inside each block, the sixth the longest.
 */
import type { Difficulty } from "@/games/types";
import { PRESETS, seedOf, type RunDef } from "@/phaser/sim/runner";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

export interface DashLevel {
  id: string;
  name: string;
  difficulty: Difficulty;
  /** metres to reach */
  target: number;
  seed: number;
}

const NAMES = [
  "First Steps",
  "Crate Lane",
  "Cone Zone",
  "Hop Street",
  "Long Stride",
  "Home Stretch",
  "Mind the Gap",
  "Low Fliers",
  "Duck Season",
  "Hurdle Row",
  "Quick Feet",
  "Drone Alley",
  "Tall Order",
  "Stack Yard",
  "Head Down",
  "Twin Crates",
  "Sky Watch",
  "Night Shift",
  "Fast Lane",
  "Balloon Fair",
  "Choice Cuts",
  "Rush Hour",
  "Overpass",
  "Long Haul",
  "Top Gear",
  "Full Tilt",
  "Red Line",
  "Afterburner",
  "Last Light",
  "Marathon",
] as const;

/** Targets per block of six levels (one block per difficulty). */
const TARGETS: number[][] = [
  [120, 160, 200, 250, 300, 400],
  [200, 250, 300, 350, 400, 500],
  [250, 300, 350, 400, 500, 600],
  [300, 350, 400, 500, 600, 700],
  [350, 400, 500, 600, 700, 800],
];

export const LEVELS: DashLevel[] = NAMES.map((name, i) => ({
  id: `lvl-${String(i + 1).padStart(2, "0")}`,
  name,
  difficulty: DIFFICULTIES[Math.floor(i / 6)],
  target: TARGETS[Math.floor(i / 6)][i % 6],
  seed: seedOf(`dash:level:${i + 1}`),
}));

export const LEVEL_BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

/** Endless run ids, one per difficulty. */
export const runId = (d: Difficulty) => `run-${d}`;
export const RUN_IDS = DIFFICULTIES.map(runId);

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  mega: "Mega",
};

/**
 * The run a course plays. Unknown ids (a course saved by the old segment-based Dash) play as a Medium endless run
 * seeded from the ids, so an old saved game or ghost opens instead of crashing.
 */
export function runDefFor(levels: readonly string[], seed: number | undefined): RunDef & { name: string } {
  const id = levels[0] ?? "";
  const lvl = LEVEL_BY_ID.get(id);
  if (lvl) return { preset: PRESETS[lvl.difficulty], seed: lvl.seed, target: lvl.target, name: `${lvl.name}, reach ${lvl.target} m` };
  const d = DIFFICULTIES.find((x) => runId(x) === id);
  if (d) return { preset: PRESETS[d], seed: seedOf(seed ?? 1), name: `Endless run, ${DIFFICULTY_LABEL[d]}` };
  return { preset: PRESETS.medium, seed: seedOf(`${levels.join(",")}:${seed ?? 0}`), name: "Endless run" };
}
