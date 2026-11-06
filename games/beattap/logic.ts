/**
 * Beat Tap: tap on the beat of a short seeded pattern. Each beat is judged Perfect, Good or Miss by how
 * close the nearest tap landed; taps that match no beat are strays and cost points, so tapping all the
 * time never pays.
 *
 * The client submits only its tap times (ms after the song started). `judge` is the one pure function the
 * board (live feedback) and the server (verify) both run, with the same windows, so a forged judgement or
 * score cannot verify. Beats are never closer than 500 ms, so the pulses stay at or under 2 Hz.
 *
 * Count-in (R2-10): four clicks at the song's own pulse lead into the first beat (`countIn`). Scoring opens only
 * when the first beat's window does (`scoreFrom`): a tap before that (the tap that started the round, or a tap
 * along with the count) is a count-in tap. `judge` skips it on the board and on the server alike, so it is never
 * a stray. Practice rounds judge with no stray penalty at all (`judge(..., 0)`); practice is never scored on
 * the server (nothing is recorded), so the server always uses STRAY_PENALTY.
 */
import type { Difficulty, GameLogic, Generated, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { checkTapTimes, FLASH_PERIOD_MS, HUMAN_FLOOR_MS, stdev } from "@/games/_shared/reflex";

/** |tap - beat| up to this is Perfect */
export const PERFECT_MS = 60;
/** |tap - beat| up to this is Good; further away the beat is a Miss */
export const GOOD_MS = 140;
/** The first beat comes this long after Start, so there is time to find the rhythm. */
export const LEAD_MS = 2000;
/** Beats are at least this far apart: pulses at most 2 Hz (the shared photosensitivity cap). */
export const MIN_GAP_MS = FLASH_PERIOD_MS;
/** With this many matched taps, a spread under MIN_SPREAD_MS (standard deviation of offsets) looks scripted. */
export const SPREAD_SAMPLE = 8;
export const MIN_SPREAD_MS = 3;

export const POINTS = { perfect: 300, good: 100 } as const;
export const STRAY_PENALTY = 50;
/** Clicks in the count-in before the first beat. */
export const COUNT_IN = 4;
/** `Judgement.tapBeat` for a tap before scoring opened (count-in): never judged, never a stray. */
export const COUNT_IN_TAP = -2;

export type Mark = "perfect" | "good" | "miss";

export interface BeatPuzzle {
  /** beat times, ms after Start, increasing */
  beats: number[];
  perfectMs: number;
  goodMs: number;
}
export type BeatSolution = null;
export interface BeatState {
  /** tap times, ms after Start, increasing */
  taps: number[];
  /** the song played to the end */
  done: boolean;
}

/** Grid step (ms) and the gaps between beats in steps, per difficulty. Every gap is at least MIN_GAP_MS. */
export const PATTERN_FOR: Record<Difficulty, { step: number; gaps: number[]; count: number }> = {
  easy: { step: 750, gaps: [1, 1, 1, 2], count: 16 },
  medium: { step: 250, gaps: [2, 3, 3, 4], count: 20 },
  hard: { step: 250, gaps: [2, 2, 3, 5], count: 24 },
  expert: { step: 200, gaps: [3, 3, 4, 5, 7], count: 28 },
  mega: { step: 200, gaps: [3, 3, 4, 5, 7], count: 36 },
};

export function generate(rng: Rng, difficulty: Difficulty): Generated<BeatPuzzle, BeatSolution> {
  const { step, gaps, count } = PATTERN_FOR[difficulty];
  const beats = [LEAD_MS];
  while (beats.length < count) beats.push(beats[beats.length - 1] + step * rng.pick(gaps));
  return { puzzle: { beats, perfectMs: PERFECT_MS, goodMs: GOOD_MS }, solution: null, grade: grade(beats) };
}

/** Uneven gaps (syncopation) and more beats are harder. */
export function grade(beats: number[]) {
  const gaps = beats.slice(1).map((b, i) => b - beats[i]);
  return Math.min(100, Math.round(beats.length * 1.5 + new Set(gaps).size * 8));
}

/** The count-in pulse: the song's shortest gap (at least MIN_GAP_MS, so the count never beats faster than 2 Hz). */
export function countInGap(beats: number[]): number {
  let g = Infinity;
  for (let i = 1; i < beats.length; i++) g = Math.min(g, beats[i] - beats[i - 1]);
  return Number.isFinite(g) ? Math.max(MIN_GAP_MS, g) : MIN_GAP_MS;
}

/**
 * The count-in clicks, on the song clock (ms; the first ones can be before 0): one gap apart, the last one a gap
 * before the first beat. The board starts its clock one more gap before the first click.
 */
export function countIn(beats: number[]): number[] {
  const g = countInGap(beats);
  return Array.from({ length: COUNT_IN }, (_, k) => beats[0] - (COUNT_IN - k) * g);
}

/** Song-clock time at the tap that starts the round: one gap of quiet, then the count-in. */
export const clockAtStart = (beats: number[]) => countIn(beats)[0] - countInGap(beats);

/** Scoring opens when the first beat's Good window does; earlier taps are count-in taps. */
export const scoreFrom = (beats: number[], goodMs = GOOD_MS) => beats[0] - goodMs;

export interface Judgement {
  /** per beat; beats after the last tap that are still inside their window count as Miss too */
  marks: Mark[];
  /** per beat, tap minus beat for matched beats, else null */
  offsets: (number | null)[];
  /** per tap, the beat it matched, -1 for a stray, or COUNT_IN_TAP for a tap before scoring opened */
  tapBeat: number[];
  perfect: number;
  good: number;
  miss: number;
  strays: number;
  score: number;
}

/**
 * Matches taps to beats in time order: a tap takes the earliest unmatched beat whose Good window holds
 * it; otherwise it is a stray. Beats are at least 500 ms apart and the window is 140 ms, so no tap can
 * sit in two windows. Taps before `scoreFrom` (the count-in) are skipped. `strayPenalty` is 0 in practice.
 * Pure and deterministic: the board and the server share it.
 */
export function judge(beats: number[], taps: number[], perfectMs = PERFECT_MS, goodMs = GOOD_MS, strayPenalty = STRAY_PENALTY): Judgement {
  const marks: Mark[] = beats.map(() => "miss");
  const offsets: (number | null)[] = beats.map(() => null);
  const tapBeat: number[] = [];
  const opens = beats.length ? scoreFrom(beats, goodMs) : Infinity;
  let b = 0;
  for (const t of taps) {
    if (t < opens) {
      tapBeat.push(COUNT_IN_TAP);
      continue;
    }
    while (b < beats.length && beats[b] + goodMs < t) b++;
    const d = b < beats.length ? t - beats[b] : Infinity;
    if (Math.abs(d) <= goodMs) {
      marks[b] = Math.abs(d) <= perfectMs ? "perfect" : "good";
      offsets[b] = d;
      tapBeat.push(b);
      b++;
    } else tapBeat.push(-1);
  }
  const perfect = marks.filter((m) => m === "perfect").length;
  const good = marks.filter((m) => m === "good").length;
  const strays = tapBeat.filter((x) => x === -1).length;
  const score = Math.max(0, perfect * POINTS.perfect + good * POINTS.good - strays * strayPenalty);
  return { marks, offsets, tapBeat, perfect, good, miss: beats.length - perfect - good, strays, score };
}

/** When the song is over: the last beat's window has closed. */
export const songEnd = (p: BeatPuzzle) => p.beats[p.beats.length - 1] + p.goodMs;

export interface Check {
  ok: boolean;
  reason?: string;
  j?: Judgement;
}

export function check(p: BeatPuzzle, state: BeatState): Check {
  if (!state || !Array.isArray(state.taps) || typeof state.done !== "boolean") return { ok: false, reason: "malformed state" };
  if (p.perfectMs !== PERFECT_MS || p.goodMs !== GOOD_MS) return { ok: false, reason: "windows do not match" };
  if (!p.beats.length || p.beats[0] < LEAD_MS || p.beats.some((b, i) => i > 0 && b - p.beats[i - 1] < MIN_GAP_MS))
    return { ok: false, reason: "pulse rate above 2 Hz" };
  const timing = checkTapTimes(state.taps, HUMAN_FLOOR_MS);
  if (timing) return { ok: false, reason: timing };
  if (state.taps.length && state.taps[state.taps.length - 1] > songEnd(p)) return { ok: false, reason: "tap after the song ended" };
  const j = judge(p.beats, state.taps, p.perfectMs, p.goodMs);
  const matched = j.offsets.filter((o): o is number => o !== null);
  if (matched.length >= SPREAD_SAMPLE && stdev(matched) < MIN_SPREAD_MS) return { ok: false, reason: "taps too consistent" };
  return { ok: true, j };
}

/** Beats whose window has opened by the last tap (never ahead of what the player has already heard). */
function heard(p: BeatPuzzle, state: BeatState) {
  if (state.done) return p.beats.length;
  const last = state.taps[state.taps.length - 1] ?? 0;
  return p.beats.filter((b) => b - p.goodMs <= last).length;
}

export function verify(p: BeatPuzzle, _sol: BeatSolution, state: BeatState): VerifyResult {
  const c = check(p, state);
  if (!c.ok) return { ok: false, progress: 0, reason: c.reason };
  if (!state.done) return { ok: false, progress: heard(p, state) / p.beats.length, reason: "song not finished" };
  return { ok: true, progress: 1, score: c.j!.score };
}

export function progress(p: BeatPuzzle, _sol: BeatSolution, state: BeatState): number {
  return check(p, state).ok ? heard(p, state) / p.beats.length : 0;
}

const logic: GameLogic<BeatPuzzle, BeatSolution, BeatState> = {
  id: "beattap",
  generate,
  verify,
  progress,
};
export default logic;
