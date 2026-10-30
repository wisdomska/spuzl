/**
 * Flinch: tap the instant the screen changes. Best of 5 rounds. The wait before each change is
 * seeded. Early taps are false starts and cost points.
 *
 * The client submits, per round, when it tapped (ms after the round armed) and the reaction it
 * showed. The server checks both against the seeded schedule, the 100 ms human floor and the
 * spread of the reactions (a script taps with near zero variance).
 */
import type { Difficulty, GameLogic, Generated, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { HUMAN_FLOOR_MS, stdev } from "@/games/_shared/reflex";

export const ROUNDS = 5;
/** After the change, a round times out after this long. */
export const WINDOW_MS = 1500;
export const FALSE_START_PENALTY = 200;
/** Valid reactions closer together than this (standard deviation) look scripted. */
export const MIN_SPREAD_MS = 4;
/** The change never comes sooner than this after arming, so the screen changes well under 2 Hz. */
export const MIN_DELAY_MS = 1500;

export const DELAY_FOR: Record<Difficulty, [number, number]> = {
  easy: [1500, 3000],
  medium: [1500, 4000],
  hard: [1500, 5000],
  expert: [1500, 6000],
  mega: [1500, 7000],
};

export interface FlinchPuzzle {
  /** ms from arming to the change, per round */
  delays: number[];
  window: number;
}
export type FlinchSolution = null;
export interface FlinchRound {
  /** ms from arming to the tap; null when the round timed out */
  tapAt: number | null;
  /** tapAt minus the delay; null for a false start or a timeout */
  reaction: number | null;
}
export interface FlinchState {
  rounds: FlinchRound[];
}

export type Outcome = "valid" | "early" | "timeout";

/** How a tap at `tapAt` in a round with `delay` counts. Under the human floor counts as early. */
export function classify(delay: number, tapAt: number | null, window = WINDOW_MS): Outcome {
  if (tapAt === null || tapAt - delay > window) return "timeout";
  return tapAt - delay < HUMAN_FLOOR_MS ? "early" : "valid";
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<FlinchPuzzle, FlinchSolution> {
  const [lo, hi] = DELAY_FOR[difficulty];
  const delays = Array.from({ length: ROUNDS }, () => rng.int(lo / 10, hi / 10) * 10);
  return { puzzle: { delays, window: WINDOW_MS }, solution: null, grade: grade(hi - lo) };
}

/** A wider spread of waits is harder to anticipate. */
export function grade(spread: number) {
  return Math.min(100, Math.round(spread / 60));
}

export const pointsFor = (reaction: number) => Math.max(0, 1000 - reaction);

export interface Tally {
  ok: boolean;
  reason?: string;
  score: number;
  best: number | null;
  early: number;
  done: number;
}

export function tally(p: FlinchPuzzle, state: FlinchState): Tally {
  const fail = (reason: string): Tally => ({ ok: false, reason, score: 0, best: null, early: 0, done: 0 });
  if (!state || !Array.isArray(state.rounds) || state.rounds.length > p.delays.length) return fail("malformed state");
  if (p.delays.some((d) => d < MIN_DELAY_MS)) return fail("schedule changes too fast");
  let score = 0, early = 0;
  const valid: number[] = [];
  for (let i = 0; i < state.rounds.length; i++) {
    const r = state.rounds[i];
    if (!r || typeof r !== "object") return fail("malformed round");
    const { tapAt, reaction } = r;
    if (tapAt !== null && (!Number.isInteger(tapAt) || tapAt < 0)) return fail("malformed tap time");
    if (reaction !== null && !Number.isInteger(reaction)) return fail("malformed reaction");
    const kind = classify(p.delays[i], tapAt, p.window);
    const expected = kind === "valid" ? tapAt! - p.delays[i] : null;
    if (reaction !== null && reaction < HUMAN_FLOOR_MS) return fail("faster than the human floor");
    if (reaction !== expected) return fail("reaction does not match the schedule");
    if (kind === "valid") {
      valid.push(expected!);
      score += pointsFor(expected!);
    } else if (kind === "early") {
      early++;
      score -= FALSE_START_PENALTY;
    }
  }
  if (valid.length >= 4 && stdev(valid) < MIN_SPREAD_MS) return fail("reactions too consistent");
  return { ok: true, score: Math.max(0, score), best: valid.length ? Math.min(...valid) : null, early, done: state.rounds.length };
}

export function verify(p: FlinchPuzzle, _sol: FlinchSolution, state: FlinchState): VerifyResult {
  const t = tally(p, state);
  if (!t.ok) return { ok: false, progress: 0, reason: t.reason };
  const progress = t.done / p.delays.length;
  if (t.done < p.delays.length) return { ok: false, progress, reason: "rounds left" };
  return { ok: true, progress: 1, score: t.score };
}

export function progress(p: FlinchPuzzle, _sol: FlinchSolution, state: FlinchState): number {
  return tally(p, state).done / p.delays.length;
}

const logic: GameLogic<FlinchPuzzle, FlinchSolution, FlinchState> = {
  id: "flinch",
  generate,
  verify,
  progress,
};
export default logic;
