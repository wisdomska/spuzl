/**
 * Echo: watch the pads, repeat the sequence. Each round adds one step. Score = longest sequence
 * repeated. The sequence is seeded; the server replays the tap log against it and checks timings.
 */
import type { Difficulty, GameLogic, Generated, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { checkTapTimes, FLASH_ON_MS, FLASH_PERIOD_MS, HUMAN_FLOOR_MS } from "@/games/_shared/reflex";

export const PADS = 4;
/** The run ends if the player waits this long between taps. */
export const IDLE_MS = 5000;

export interface EchoPuzzle {
  /** pad index per step */
  seq: number[];
  /** length of the first round */
  start: number;
  /** one step of playback, ms (2 Hz cap: never under 500) */
  stepMs: number;
  /** how long a pad stays lit during playback */
  onMs: number;
}
/** The sequence is shown to the player, so there is no secret. */
export type EchoSolution = null;
export interface EchoRound {
  /** [pad, ms since the round's input opened] */
  taps: [number, number][];
}
export interface EchoState {
  rounds: EchoRound[];
}

const SHAPE = ["circle", "triangle", "square", "diamond"] as const;
export const padName = (i: number) => SHAPE[i];

export const START_FOR: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4, mega: 3 };
export const LENGTH_FOR: Record<Difficulty, number> = { easy: 40, medium: 40, hard: 45, expert: 50, mega: 64 };

/** No pad repeats more than twice in a row, which reads as one long light. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<EchoPuzzle, EchoSolution> {
  const len = LENGTH_FOR[difficulty];
  const seq: number[] = [];
  while (seq.length < len) {
    const p = rng.int(0, PADS - 1);
    const n = seq.length;
    if (n >= 2 && seq[n - 1] === p && seq[n - 2] === p) continue;
    seq.push(p);
  }
  const start = START_FOR[difficulty];
  return { puzzle: { seq, start, stepMs: FLASH_PERIOD_MS, onMs: FLASH_ON_MS }, solution: null, grade: grade(start, len) };
}

/** Longer opening rounds are harder; a longer tail only matters for marathon runs. */
export function grade(start: number, len: number) {
  return Math.min(100, start * 20 + Math.round(len / 8));
}

export interface Replay {
  ok: boolean;
  reason?: string;
  /** longest sequence repeated in full */
  best: number;
  /** the last round ended on a wrong pad, an idle timeout or the end of the sequence */
  over: boolean;
}

/** Replays the tap log against the seeded sequence. */
export function replay(p: EchoPuzzle, state: EchoState): Replay {
  const fail = (reason: string): Replay => ({ ok: false, reason, best: 0, over: false });
  if (!state || !Array.isArray(state.rounds)) return fail("malformed state");
  if (p.stepMs < FLASH_PERIOD_MS || p.onMs > p.stepMs - (FLASH_PERIOD_MS - FLASH_ON_MS)) return fail("flash rate above 2 Hz");
  let best = 0;
  for (let r = 0; r < state.rounds.length; r++) {
    const round = state.rounds[r];
    const len = p.start + r;
    if (len > p.seq.length) return fail("more rounds than steps");
    if (!round || !Array.isArray(round.taps) || round.taps.length > len) return fail("malformed round");
    for (const t of round.taps) if (!Array.isArray(t) || t.length !== 2 || !Number.isInteger(t[0]) || t[0] < 0 || t[0] >= PADS) return fail("malformed tap");
    const timing = checkTapTimes(round.taps.map((t) => t[1]), HUMAN_FLOOR_MS, IDLE_MS);
    if (timing) return fail(timing);
    const wrong = round.taps.findIndex(([pad], i) => pad !== p.seq[i]);
    const last = r === state.rounds.length - 1;
    if (wrong !== -1) {
      if (!last || wrong !== round.taps.length - 1) return fail("taps after a wrong pad");
      return { ok: true, best, over: true };
    }
    if (round.taps.length < len) {
      // An unfinished round can only be the last one: the player went idle.
      return last ? { ok: true, best, over: true } : fail("round left unfinished");
    }
    best = len;
  }
  const maxed = best === p.seq.length;
  return { ok: true, best, over: maxed };
}

export function verify(p: EchoPuzzle, _sol: EchoSolution, state: EchoState): VerifyResult {
  const r = replay(p, state);
  if (!r.ok) return { ok: false, progress: 0, reason: r.reason };
  const progress = r.best / p.seq.length;
  if (!r.over) return { ok: false, progress, reason: "run not finished" };
  return { ok: true, progress, score: r.best };
}

export function progress(p: EchoPuzzle, _sol: EchoSolution, state: EchoState): number {
  return replay(p, state).best / p.seq.length;
}

const logic: GameLogic<EchoPuzzle, EchoSolution, EchoState> = {
  id: "echo",
  generate,
  verify,
  progress,
};
export default logic;
