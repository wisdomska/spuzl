/**
 * Dash: endless runner. Spuz runs on its own and speeds up with distance; JUMP clears low obstacles and gaps
 * (hold for higher), DOWN ducks under drones (and drops fast in the air). Free play, Ghost Race and Dailies are an
 * endless run at the difficulty's speed preset, seeded per puzzle: one hit ends it, score = metres. Levels mode is
 * a ladder of fixed runs with a distance to reach (games/dash/levels.ts); a hit restarts that run.
 *
 * verify() re-simulates the input log (phaser/sim/runner.ts) and rejects any claimed score, crash count or time
 * that does not match. Pure TypeScript, safe on the server.
 */
import type { Difficulty, GameLogic, Generated, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { replay } from "@/phaser/sim/core";
import { isRageState, replayPartial, type CoursePuzzle, type CourseSolution, type RageState } from "@/phaser/sim/course";
import { RunnerSim } from "@/phaser/sim/runner";
import { DIFFICULTIES, LEVELS, runDefFor, runId } from "./levels";

export type DashPuzzle = CoursePuzzle;
export type DashSolution = CourseSolution;
export type DashState = RageState;

export function createSim(p: CoursePuzzle): RunnerSim {
  return new RunnerSim(runDefFor(Array.isArray(p?.levels) ? p.levels : [], p?.seed));
}

/** Display name of a course: "Endless run, Medium" or "Crate Lane, reach 160 m". */
export const runName = (p: CoursePuzzle) => runDefFor(p.levels, p.seed).name;

/**
 * A state saved by the old segment-based Dash (no score) cannot replay on the runner: the board starts fresh
 * instead of restoring it.
 */
export function freshState(s: RageState | undefined | null): RageState | undefined {
  return s && typeof s === "object" && Number.isInteger(s.score) ? s : undefined;
}

function generate(rng: Rng, difficulty: Difficulty): Generated<CoursePuzzle, CourseSolution> {
  const seed = rng.int(1, 2 ** 31 - 1);
  const puzzle: CoursePuzzle = { levels: [runId(difficulty)], seed };
  return { puzzle, solution: { levels: [runId(difficulty)], seed }, grade: 10 + 20 * DIFFICULTIES.indexOf(difficulty) };
}

/**
 * The course must be the scheduled one. Any ids are accepted (old segment courses play as an endless run, see
 * runDefFor), because the server compares the puzzle with its own copy.
 */
const sameCourse = (p: CoursePuzzle, s: CourseSolution) =>
  !!p &&
  !!s &&
  Array.isArray(p.levels) &&
  p.levels.length >= 1 &&
  p.levels.length <= 20 &&
  p.levels.length === s.levels.length &&
  p.levels.every((id, i) => typeof id === "string" && id === s.levels[i]) &&
  p.seed === s.seed;

function progress(p: CoursePuzzle, s: CourseSolution, state: RageState): number {
  if (!sameCourse(p, s) || !isRageState(state)) return 0;
  return replayPartial(createSim(p), state.log).progress();
}

function verify(p: CoursePuzzle, s: CourseSolution, state: RageState): VerifyResult {
  if (!sameCourse(p, s)) return { ok: false, progress: 0, reason: "course does not match the schedule" };
  if (!isRageState(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const r = replay(createSim(p), state.log);
  const prog = r.ok ? 1 : Math.min(0.99, r.progress);
  if (!r.ok) return { ok: false, progress: prog, reason: r.reason };
  if (r.deaths !== state.deaths) return { ok: false, progress: prog, reason: "deaths do not match the replay" };
  if (r.timeMs !== state.timeMs) return { ok: false, progress: prog, reason: "time does not match the replay" };
  if (state.score !== r.score) return { ok: false, progress: prog, reason: "score does not match the replay" };
  return { ok: true, progress: 1, score: r.score };
}

/** Level n of the ladder: one fixed run with a distance to reach. */
function level(n: number): Generated<CoursePuzzle, CourseSolution> | null {
  if (!Number.isInteger(n) || n < 1 || n > LEVELS.length) return null;
  const id = LEVELS[n - 1].id;
  return { puzzle: { levels: [id] }, solution: { levels: [id] }, grade: Math.round((100 * (n - 1)) / Math.max(1, LEVELS.length - 1)) };
}

const logic: GameLogic<CoursePuzzle, CourseSolution, RageState> = { id: "dash", generate, verify, progress, level };

export { generate, verify, progress, level };
export default logic;
