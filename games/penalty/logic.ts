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
 *
 * The keeper's dives are the secret part: they stay in the solution on the server. Each shot goes through
 * the guess transport (games/_shared/guess.ts) once both taps are in; the server keeps the shot on the
 * attempt and only then answers with the dive and the outcome. A shot can't be taken back or changed, and
 * finish checks that the final state holds exactly the shots the server answered (`audit`). Clears whose
 * taps land on the sweet spots with a machine's regularity are flagged for moderation (`suspect`).
 */
import type { Difficulty, Generated, VerifyResult } from "@/games/types";
import type { GuessContext, GuessLogic } from "@/games/_shared/guess";
import type { PuzzleRef } from "@/games/_shared/guess";
import { createRng, type Rng } from "@/lib/rng";
import { HUMAN_FLOOR_MS, stdev } from "@/games/_shared/reflex";

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
/** Seeded schedules per difficulty, addressed by index like a content game (`generateAt`). */
export const contentCount = 10_000;
/**
 * Bot check: with at least this many taps on shots, a spread (standard deviation) of their distance from
 * the nearest sweet-spot moment under MIN_SPREAD_MS is too regular for a person.
 */
export const SPREAD_SAMPLE = 8;
export const MIN_SPREAD_MS = 4;

export type Dive = 0 | 1 | 2; // left, stay, right
export type Zone = Dive;

export interface KickSpec {
  /** ms for the aim meter to go 0 -> 100 -> 0 (even) */
  aimPeriod: number;
  /** ms for the power meter to go 0 -> 100 -> 0 (even) */
  powerPeriod: number;
}
export interface PenaltyPuzzle {
  ref: PuzzleRef;
  kicks: KickSpec[];
  kickMs: number;
  /** power below this is too soft: the keeper gets back to it wherever it goes */
  soft: number;
}
export interface PenaltySolution {
  /** where the keeper goes on each kick (server only) */
  dives: Dive[];
}
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

/** A shot for the server to answer: kick index and its taps. */
export interface PenaltyGuess {
  kick: number;
  input: KickInput;
}
export type PenaltyCheck = { ok: true; outcome: KickOutcome; dive: Dive } | { ok: false; refused: true } | { ok: false; invalid: true };

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

/** The schedule at one index: meter speeds for the board, dives for the server. Deterministic. */
export function generateAt(index: number, difficulty: Difficulty): Generated<PenaltyPuzzle, PenaltySolution> {
  const i = ((Math.floor(index) % contentCount) + contentCount) % contentCount;
  const rng = createRng(`penalty:${i}`);
  const p = PERIODS[difficulty];
  const period = ([lo, hi]: [number, number]) => rng.int(lo / 20, hi / 20) * 20;
  const kicks: KickSpec[] = [];
  const dives: Dive[] = [];
  for (let k = 0; k < KICKS; k++) {
    kicks.push({ aimPeriod: period(p.aim), powerPeriod: period(p.power) });
    const r = rng.int(0, 9);
    dives.push(r < 4 ? 0 : r < 8 ? 2 : 1);
  }
  return {
    puzzle: { ref: { game: "penalty", i, d: difficulty }, kicks, kickMs: KICK_MS, soft: p.soft },
    solution: { dives },
    grade: grade(kicks),
  };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<PenaltyPuzzle, PenaltySolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** Faster meters are harder. */
export function grade(kicks: KickSpec[]) {
  const avg = kicks.reduce((a, k) => a + k.aimPeriod + k.powerPeriod, 0) / (2 * kicks.length);
  return Math.max(0, Math.min(100, Math.round((3200 - avg) / 22)));
}

const isTime = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0;

/**
 * Reads one kick's taps off the meters (no keeper needed). Returns a reason string when the input cannot be
 * real. The board uses it to show where the shot went; `power` is null when the kick timed out first.
 */
export function readKick(p: PenaltyPuzzle, i: number, k: KickInput): { aim: number | null; power: number | null } | string {
  if (!k || typeof k !== "object") return "malformed kick";
  const { aimAt, powerAt } = k;
  const stepped = k.stepped === true;
  if (k.stepped !== undefined && typeof k.stepped !== "boolean") return "malformed kick";
  if (aimAt !== null && !isTime(aimAt)) return "malformed tap time";
  if (powerAt !== null && !isTime(powerAt)) return "malformed tap time";
  const spec = p.kicks[i];
  if (!spec) return "malformed kick";
  if (aimAt === null) return powerAt !== null ? "power set before aim" : { aim: null, power: null };
  if (aimAt < HUMAN_FLOOR_MS) return "faster than the human floor";
  if (aimAt > p.kickMs) return "tap after the kick timed out";
  const aim = meterAt(aimAt, spec.aimPeriod, stepped);
  if (powerAt === null) return { aim, power: null };
  if (powerAt < HUMAN_FLOOR_MS) return "faster than the human floor";
  if (aimAt + powerAt > p.kickMs) return "tap after the kick timed out";
  return { aim, power: meterAt(powerAt, spec.powerPeriod, stepped) };
}

/** A kick that ran out of time before the power tap: no shot, so no keeper. */
export const timeoutOutcome = (aim: number | null): KickOutcome => ({
  result: "timeout",
  aim,
  power: null,
  zone: null,
  accuracy: 0,
  points: 0,
});

/** Replays one kick's taps against the keeper. Returns a reason string when the input cannot be real. */
export function replayKick(p: PenaltyPuzzle, s: PenaltySolution, i: number, k: KickInput): KickOutcome | string {
  const r = readKick(p, i, k);
  if (typeof r === "string") return r;
  if (r.aim === null || r.power === null) return timeoutOutcome(r.aim);
  const dive = s?.dives?.[i];
  if (dive !== 0 && dive !== 1 && dive !== 2) return "no keeper for this kick";
  return { aim: r.aim, power: r.power, ...shoot(r.aim, r.power, dive, p.soft) };
}

export interface Tally {
  ok: boolean;
  reason?: string;
  outcomes: KickOutcome[];
  goals: number;
  score: number;
}

export function tally(p: PenaltyPuzzle, s: PenaltySolution, state: PenaltyState): Tally {
  const fail = (reason: string): Tally => ({ ok: false, reason, outcomes: [], goals: 0, score: 0 });
  if (!state || !Array.isArray(state.kicks) || state.kicks.length > p.kicks.length) return fail("malformed state");
  if (p.kicks.some((k) => k.aimPeriod < MIN_PERIOD_MS || k.powerPeriod < MIN_PERIOD_MS)) return fail("meters too fast");
  const outcomes: KickOutcome[] = [];
  for (let i = 0; i < state.kicks.length; i++) {
    const o = replayKick(p, s, i, state.kicks[i]);
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

export function verify(p: PenaltyPuzzle, s: PenaltySolution, state: PenaltyState): VerifyResult {
  const t = tally(p, s, state);
  if (!t.ok) return { ok: false, progress: 0, reason: t.reason };
  const progress = t.outcomes.length / p.kicks.length;
  if (t.outcomes.length < p.kicks.length) return { ok: false, progress, reason: "kicks left" };
  return { ok: true, progress: 1, score: t.score };
}

export function progress(p: PenaltyPuzzle, s: PenaltySolution, state: PenaltyState): number {
  return tally(p, s, state).outcomes.length / p.kicks.length;
}

/* ---------- Server check per shot (guess transport) ---------- */

type Shot = { kick: number; aimAt: number; powerAt: number; stepped: boolean };
const isShot = (k: KickInput | null | undefined) => !!k && k.aimAt !== null && k.powerAt !== null;
const sameShot = (a: Shot, k: KickInput) => a.aimAt === k.aimAt && a.powerAt === k.powerAt && a.stepped === (k.stepped === true);

/** Shots the server answered on this attempt (its move log), by kick. */
function loggedShots(log: unknown[]): Map<number, Shot> {
  const out = new Map<number, Shot>();
  for (const e of log) {
    const x = e as Partial<Shot> | null;
    if (x && typeof x === "object" && Number.isInteger(x.kick) && !out.has(x.kick!))
      out.set(x.kick!, { kick: x.kick!, aimAt: x.aimAt as number, powerAt: x.powerAt as number, stepped: x.stepped === true });
  }
  return out;
}

/**
 * Answers one committed shot with the keeper's dive and the outcome. On an attempt, a kick already answered
 * is only answered again for the very same taps (a resume), and an earlier kick can't be taken after a later
 * one; with no context (a bare puzzle reference) it is refused. Timeouts need no keeper and are refused too.
 */
export function checkGuess(p: PenaltyPuzzle, s: PenaltySolution, g: PenaltyGuess, ctx: GuessContext = null): PenaltyCheck {
  if (!g || typeof g !== "object" || !Number.isInteger(g.kick) || g.kick < 0 || g.kick >= p.kicks.length)
    return { ok: false, invalid: true };
  const o = replayKick(p, s, g.kick, g.input);
  if (typeof o === "string" || !isShot(g.input)) return { ok: false, invalid: true };
  if (!ctx) return { ok: false, refused: true };
  if (ctx.kind === "attempt") {
    const shots = loggedShots(ctx.log);
    const before = shots.get(g.kick);
    if (before ? !sameShot(before, g.input) : [...shots.keys()].some((k) => k > g.kick)) return { ok: false, refused: true };
  }
  return { ok: true, outcome: o, dive: s.dives[g.kick] };
}

/** Kept on the attempt: each answered shot, once, before its dive is sent. */
export function record(_p: PenaltyPuzzle, _s: PenaltySolution, g: PenaltyGuess, res: PenaltyCheck, log: unknown[]): Shot | null {
  if (!res.ok || loggedShots(log).has(g.kick)) return null;
  return { kick: g.kick, aimAt: g.input.aimAt!, powerAt: g.input.powerAt!, stepped: g.input.stepped === true };
}

/** The final state must hold exactly the shots the server answered: none skipped past it, none changed. */
export function audit(_p: PenaltyPuzzle, _s: PenaltySolution, state: PenaltyState, log: unknown[]): string | null {
  const shots = loggedShots(log);
  const kicks = Array.isArray(state?.kicks) ? state.kicks : [];
  for (let i = 0; i < kicks.length; i++) {
    if (!isShot(kicks[i])) continue;
    const s = shots.get(i);
    if (!s) return "shot the server never saw";
    if (!sameShot(s, kicks[i])) return "shot changed after the keeper moved";
  }
  for (const i of shots.keys()) if (!isShot(kicks[i])) return "answered shot missing from the state";
  return null;
}

/** Signed ms from `t` to the nearest moment a meter of `period` reads one of `targets`. */
export function sweetOffset(t: number, period: number, targets: number[]): number {
  const ph = t % period;
  let best = Infinity;
  for (const v of targets) {
    const up = (v * period) / (2 * METER_MAX);
    for (const c of [up, period - up])
      for (const shift of [-period, 0, period]) {
        const d = ph - (c + shift);
        if (Math.abs(d) < Math.abs(best)) best = d;
      }
  }
  return best;
}

/**
 * Bot check (flags, never fails): people land near the sweet spots with tens of ms of scatter. Taps whose
 * distance from the sweet-spot moment barely varies across the shots look scripted.
 */
export function suspect(p: PenaltyPuzzle, _s: PenaltySolution, state: PenaltyState): string | null {
  const offsets: number[] = [];
  for (let i = 0; i < (state?.kicks?.length ?? 0); i++) {
    const k = state.kicks[i];
    const spec = p.kicks[i];
    if (!spec || !isShot(k)) continue;
    offsets.push(sweetOffset(k.aimAt!, spec.aimPeriod, [AIM_SWEET, METER_MAX - AIM_SWEET]));
    offsets.push(sweetOffset(k.powerAt!, spec.powerPeriod, [POWER_SWEET]));
  }
  if (offsets.length < SPREAD_SAMPLE) return null;
  const spread = stdev(offsets);
  return spread < MIN_SPREAD_MS ? `tap timing too regular (spread ${spread.toFixed(1)} ms over ${offsets.length} taps)` : null;
}

const logic: GuessLogic<PenaltyPuzzle, PenaltySolution, PenaltyState, PenaltyGuess, PenaltyCheck> = {
  id: "penalty",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  record,
  audit,
  suspect,
  verify,
  progress,
};
export default logic;
