/**
 * GameLogic factory for Rage Ridge games: a Daily course is a seeded pick of hand-designed levels (or
 * seeded segments), the state is an input log plus the claimed deaths and time, and verify() re-simulates
 * the log and rejects any mismatch. Pure TypeScript, safe on the server.
 */
import type { Difficulty, GameLogic, Generated, Hint, InputLog, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { replay, deathsRankScore, type SimCore } from "./core";
import { readerFor, validateLog } from "./input";

export interface RageState {
  log: InputLog;
  deaths: number;
  timeMs: number;
  /** levels cleared when the state was saved (UI only, the server recomputes) */
  level?: number;
  /** score games: claimed points */
  score?: number;
}

/** Public course data: level ids in play order plus any seeded parameters. */
export interface CoursePuzzle {
  levels: string[];
  /** seeded tuning (wind, speeds) for games that need it */
  seed?: number;
}

/** Server copy of the course. verify() refuses a puzzle that does not match it. */
export interface CourseSolution {
  levels: string[];
  seed?: number;
}

export const COURSE_LENGTH: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5, expert: 6, mega: 8 };

export interface CourseLogicOptions {
  id: string;
  /** ids of every hand-designed level, in authoring (difficulty) order */
  pool: string[];
  /** course length per difficulty, 3..10 */
  lengths?: Record<Difficulty, number>;
  /** keep authoring order (difficulty ramp) instead of a shuffled order */
  ramp?: boolean;
  /** builds a fresh simulation for a course */
  sim(p: CoursePuzzle): SimCore;
  scoring: "deaths" | "score";
  /** draw a seeded parameter for the course */
  seeded?: boolean;
  /** hint copy for the level being played (index into the course) */
  hint?(p: CoursePuzzle, level: number): string;
}

export function isRageState(s: unknown): s is RageState {
  if (!s || typeof s !== "object") return false;
  const r = s as Partial<RageState>;
  return (
    !!r.log &&
    Number.isInteger(r.deaths) &&
    (r.deaths as number) >= 0 &&
    Number.isInteger(r.timeMs) &&
    (r.timeMs as number) >= 0 &&
    (r.score === undefined || Number.isInteger(r.score))
  );
}

/** Steps a log without requiring the course to finish (progress for partial runs). */
export function replayPartial(core: SimCore, log: InputLog): SimCore {
  if (validateLog(log)) return core;
  const at = readerFor(log);
  for (let f = 0; f < log.frames && !core.finished; f++) core.step(at(f));
  return core;
}

export function makeCourseLogic(o: CourseLogicOptions) {
  const lengths = o.lengths ?? COURSE_LENGTH;
  const known = new Set(o.pool);

  const generate = (rng: Rng, difficulty: Difficulty): Generated<CoursePuzzle, CourseSolution> => {
    const n = Math.min(o.pool.length, lengths[difficulty]);
    const picked = rng.shuffle(o.pool.map((_, i) => i)).slice(0, n);
    if (o.ramp !== false) picked.sort((a, b) => a - b);
    const levels = picked.map((i) => o.pool[i]);
    const seed = o.seeded ? rng.int(1, 2 ** 31 - 1) : undefined;
    const puzzle: CoursePuzzle = seed === undefined ? { levels } : { levels, seed };
    const avg = picked.reduce((a, b) => a + b, 0) / Math.max(1, picked.length) / Math.max(1, o.pool.length - 1);
    const grade = Math.max(0, Math.min(100, Math.round(n * 7 + avg * 40)));
    return { puzzle, solution: { ...puzzle, levels: levels.slice() }, grade };
  };

  const sameCourse = (p: CoursePuzzle, s: CourseSolution) =>
    !!p &&
    Array.isArray(p.levels) &&
    p.levels.length === s.levels.length &&
    p.levels.every((id, i) => id === s.levels[i] && known.has(id)) &&
    p.seed === s.seed;

  const progress = (p: CoursePuzzle, s: CourseSolution, state: RageState): number => {
    if (!sameCourse(p, s) || !isRageState(state)) return 0;
    const core = replayPartial(o.sim(p), state.log);
    return core.finished ? 1 : Math.min(0.99, core.cleared() / p.levels.length);
  };

  const verify = (p: CoursePuzzle, s: CourseSolution, state: RageState): VerifyResult => {
    if (!sameCourse(p, s)) return { ok: false, progress: 0, reason: "course does not match the schedule" };
    if (!isRageState(state)) return { ok: false, progress: 0, reason: "malformed state" };
    const r = replay(o.sim(p), state.log);
    const prog = r.ok ? 1 : Math.min(0.99, r.cleared / p.levels.length);
    if (!r.ok) return { ok: false, progress: prog, reason: r.reason };
    if (r.deaths !== state.deaths) return { ok: false, progress: prog, reason: "deaths do not match the replay" };
    if (r.timeMs !== state.timeMs) return { ok: false, progress: prog, reason: "time does not match the replay" };
    if (o.scoring === "score") {
      if (state.score !== r.score) return { ok: false, progress: prog, reason: "score does not match the replay" };
      return { ok: true, progress: 1, score: r.score };
    }
    return { ok: true, progress: 1, score: deathsRankScore(r.deaths, r.timeMs) };
  };

  const hint = (p: CoursePuzzle, s: CourseSolution, state: RageState | undefined): Hint | null => {
    if (!o.hint || !sameCourse(p, s)) return null;
    const core = isRageState(state) ? replayPartial(o.sim(p), state.log) : o.sim(p);
    if (core.finished) return null;
    const level = core.cleared();
    return { target: { level }, text: o.hint(p, level) };
  };

  const logic: GameLogic<CoursePuzzle, CourseSolution, RageState> = { id: o.id, generate, verify, progress, ...(o.hint ? { hint } : {}) };
  return logic;
}
