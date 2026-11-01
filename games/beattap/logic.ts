/**
 * Beat Tap: tap on the beat of a short seeded pattern. Each beat is judged Perfect, Good or Miss by how
 * close the nearest tap landed; taps that match no beat are strays and cost points, so tapping all the
 * time never pays.
 *
 * The client submits only its tap times (ms after the song started). `judge` is the one pure function the
 * board (live feedback) and the server (verify) both run, with the same windows, so a forged judgement or
 * score cannot verify. Beats are never closer than 500 ms, so the pulses stay at or under 2 Hz.
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

export interface Judgement {
  /** per beat; beats after the last tap that are still inside their window count as Miss too */
  marks: Mark[];
  /** per beat, tap minus beat for matched beats, else null */
  offsets: (number | null)[];
  /** per tap, the beat it matched or -1 for a stray */
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
 * sit in two windows. Pure and deterministic: the board and the server share it.
 */
export function judge(beats: number[], taps: number[], perfectMs = PERFECT_MS, goodMs = GOOD_MS): Judgement {
  const marks: Mark[] = beats.map(() => "miss");
  const offsets: (number | null)[] = beats.map(() => null);
  const tapBeat: number[] = [];
  let b = 0;
  for (const t of taps) {
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
  const score = Math.max(0, perfect * POINTS.perfect + good * POINTS.good - strays * STRAY_PENALTY);
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
