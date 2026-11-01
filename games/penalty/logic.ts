/**
 * Penalty King: five penalty kicks. An aim meter sweeps left to right; the first tap sets the aim, then a
 * power meter sweeps and the second tap sets the power. A seeded keeper dives left, stays or dives right.
 * Score = goals, then accuracy (how close each goal was to the sweet spot in the corner and in power).
 *
 * The client submits only tap times: per kick, when it set the aim (ms after the kick started) and when it
 * set the power (ms after the aim tap). The server replays them against the seeded meter speeds and keeper
 * dives with the same integer maths, so a forged result or score cannot verify. Taps faster than the human
 * floor are rejected. With reduced motion the meters step instead of sweep; the kick records that, and the
 * meter value is read at the start of the step the player saw, on both sides.
 */
import type { Difficulty, GameLogic, Generated, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { HUMAN_FLOOR_MS } from "@/games/_shared/reflex";

export const KICKS = 5;
/** A kick (aim plus power) must be taken within this long, or it counts as a miss. */
export const KICK_MS = 8000;
/** Reduced motion: the meters hold each value for this long, then jump to the next one. */
export const STEP_MS = 150;
/** Meters read 0..METER_MAX. */
export const METER_MAX = 100;
/** Aim below this or above METER_MAX minus this misses the posts. */
export const WIDE_EDGE = 5;
/** Aim under LEFT_EDGE goes left, over RIGHT_EDGE goes right, anything between down the middle. */
export const LEFT_EDGE = 35;
export const RIGHT_EDGE = 65;
/** Power above this flies over the bar. */
export const OVER_BAR = 92;
/** Sweet spots for accuracy points. */
export const AIM_SWEET = 15; // distance from the edge of the meter, both corners
export const POWER_SWEET = 75;
export const GOAL_POINTS = 1000;
/** Each of aim and power gives up to this many accuracy points on a goal. */
export const ACCURACY_MAX = 50;

export type Dive = 0 | 1 | 2; // left, stay, right
export type Zone = Dive;

export interface KickSpec {
  /** ms for the aim meter to go 0 -> 100 -> 0 (even) */
  aimPeriod: number;
  /** ms for the power meter to go 0 -> 100 -> 0 (even) */
  powerPeriod: number;
  /** where the keeper goes */
  dive: Dive;
}
export interface PenaltyPuzzle {
  kicks: KickSpec[];
  kickMs: number;
  /** power below this is too soft: the keeper gets back to it wherever it goes */
  soft: number;
}
export type PenaltySolution = null;
export interface KickInput {
  /** ms from the kick starting to the aim tap; null when the kick timed out first */
  aimAt: number | null;
  /** ms from the aim tap to the power tap; null when the kick timed out first */
  powerAt: number | null;
  /** the meters were stepping (reduced motion) for this kick */
  stepped?: boolean;
}
export interface PenaltyState {
  kicks: KickInput[];
}

export type KickResult = "goal" | "saved" | "wide" | "over" | "timeout";
export interface KickOutcome {
  result: KickResult;
  aim: number | null;
  power: number | null;
  zone: Zone | null;
  /** accuracy points on a goal (0 otherwise) */
  accuracy: number;
  points: number;
}

const PERIODS: Record<Difficulty, { aim: [number, number]; power: [number, number]; soft: number }> = {
  easy: { aim: [2600, 3200], power: [2200, 2800], soft: 15 },
  medium: { aim: [2000, 2600], power: [1800, 2400], soft: 20 },
  hard: { aim: [1600, 2200], power: [1400, 2000], soft: 25 },
  expert: { aim: [1300, 1800], power: [1200, 1600], soft: 30 },
  mega: { aim: [1100, 1500], power: [1000, 1400], soft: 35 },
};
export const PERIODS_FOR = PERIODS;
/** Meters never sweep faster than this full cycle. */
export const MIN_PERIOD_MS = 1000;

/**
 * Meter value at `t` ms: a triangle wave 0 -> 100 -> 0 over `period`. Integer maths only, so the board
 * and the server read the same value. With `stepped`, the value is held for STEP_MS at a time.
 */
export function meterAt(t: number, period: number, stepped = false): number {
  const s = stepped ? t - (t % STEP_MS) : t;
  const ph = s % period;
  const half = period / 2;
  return ph <= half ? Math.floor((ph * 2 * METER_MAX) / period) : Math.floor(((period - ph) * 2 * METER_MAX) / period);
}

export const zoneOf = (aim: number): Zone => (aim < LEFT_EDGE ? 0 : aim > RIGHT_EDGE ? 2 : 1);

/** Accuracy points for a goal: closeness to a corner sweet spot plus closeness to the power sweet spot. */
export function accuracyFor(aim: number, power: number): number {
  const fromEdge = Math.min(aim, METER_MAX - aim);
  const aimPts = Math.max(0, ACCURACY_MAX - 2 * Math.abs(fromEdge - AIM_SWEET));
  const powerPts = Math.max(0, ACCURACY_MAX - 2 * Math.abs(power - POWER_SWEET));
  return aimPts + powerPts;
}

/** What a kick with this aim and power does against this keeper. Pure; the board shows exactly this. */
export function shoot(aim: number, power: number, dive: Dive, soft: number): Omit<KickOutcome, "aim" | "power"> {
  const zone = zoneOf(aim);
  const miss = (result: KickResult) => ({ result, zone, accuracy: 0, points: 0 });
  if (aim < WIDE_EDGE || aim > METER_MAX - WIDE_EDGE) return miss("wide");
  if (power > OVER_BAR) return miss("over");
  if (power < soft || zone === dive) return miss("saved");
  const accuracy = accuracyFor(aim, power);
  return { result: "goal", zone, accuracy, points: GOAL_POINTS + accuracy };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<PenaltyPuzzle, PenaltySolution> {
  const p = PERIODS[difficulty];
  const period = ([lo, hi]: [number, number]) => rng.int(lo / 20, hi / 20) * 20;
  const kicks: KickSpec[] = Array.from({ length: KICKS }, () => {
    const aimPeriod = period(p.aim);
    const powerPeriod = period(p.power);
    const r = rng.int(0, 9);
    const dive: Dive = r < 4 ? 0 : r < 8 ? 2 : 1;
    return { aimPeriod, powerPeriod, dive };
  });
  return { puzzle: { kicks, kickMs: KICK_MS, soft: p.soft }, solution: null, grade: grade(kicks) };
}

/** Faster meters are harder. */
export function grade(kicks: KickSpec[]) {
  const avg = kicks.reduce((a, k) => a + k.aimPeriod + k.powerPeriod, 0) / (2 * kicks.length);
  return Math.max(0, Math.min(100, Math.round((3200 - avg) / 22)));
}

const isTime = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0;

/** Replays one kick's taps. Returns a reason string when the input cannot be real. */
export function replayKick(p: PenaltyPuzzle, i: number, k: KickInput): KickOutcome | string {
  if (!k || typeof k !== "object") return "malformed kick";
  const { aimAt, powerAt } = k;
  const stepped = k.stepped === true;
  if (k.stepped !== undefined && typeof k.stepped !== "boolean") return "malformed kick";
  if (aimAt !== null && !isTime(aimAt)) return "malformed tap time";
  if (powerAt !== null && !isTime(powerAt)) return "malformed tap time";
  const spec = p.kicks[i];
  if (aimAt === null) {
    if (powerAt !== null) return "power set before aim";
    return { result: "timeout", aim: null, power: null, zone: null, accuracy: 0, points: 0 };
  }
  if (aimAt < HUMAN_FLOOR_MS) return "faster than the human floor";
  if (aimAt > p.kickMs) return "tap after the kick timed out";
  const aim = meterAt(aimAt, spec.aimPeriod, stepped);
  if (powerAt === null) return { result: "timeout", aim, power: null, zone: null, accuracy: 0, points: 0 };
  if (powerAt < HUMAN_FLOOR_MS) return "faster than the human floor";
  if (aimAt + powerAt > p.kickMs) return "tap after the kick timed out";
  const power = meterAt(powerAt, spec.powerPeriod, stepped);
  return { aim, power, ...shoot(aim, power, spec.dive, p.soft) };
}

export interface Tally {
  ok: boolean;
  reason?: string;
  outcomes: KickOutcome[];
  goals: number;
  score: number;
}

export function tally(p: PenaltyPuzzle, state: PenaltyState): Tally {
  const fail = (reason: string): Tally => ({ ok: false, reason, outcomes: [], goals: 0, score: 0 });
  if (!state || !Array.isArray(state.kicks) || state.kicks.length > p.kicks.length) return fail("malformed state");
  if (p.kicks.some((k) => k.aimPeriod < MIN_PERIOD_MS || k.powerPeriod < MIN_PERIOD_MS)) return fail("meters too fast");
  const outcomes: KickOutcome[] = [];
  for (let i = 0; i < state.kicks.length; i++) {
    const o = replayKick(p, i, state.kicks[i]);
    if (typeof o === "string") return fail(o);
    outcomes.push(o);
  }
  return {
    ok: true,
    outcomes,
    goals: outcomes.filter((o) => o.result === "goal").length,
    score: outcomes.reduce((a, o) => a + o.points, 0),
  };
}

export function verify(p: PenaltyPuzzle, _sol: PenaltySolution, state: PenaltyState): VerifyResult {
  const t = tally(p, state);
  if (!t.ok) return { ok: false, progress: 0, reason: t.reason };
  const progress = t.outcomes.length / p.kicks.length;
  if (t.outcomes.length < p.kicks.length) return { ok: false, progress, reason: "kicks left" };
  return { ok: true, progress: 1, score: t.score };
}

export function progress(p: PenaltyPuzzle, _sol: PenaltySolution, state: PenaltyState): number {
  return tally(p, state).outcomes.length / p.kicks.length;
}

const logic: GameLogic<PenaltyPuzzle, PenaltySolution, PenaltyState> = {
  id: "penalty",
  generate,
  verify,
  progress,
};
export default logic;
