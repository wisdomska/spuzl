/**
 * Azonto Steps (R2-P5, lab game): Spuz dances a short sequence of Azonto moves to a gentle beat, the player repeats
 * it on a four-move pad, and every round adds one move (Simon-style). Score = the longest sequence repeated.
 *
 * The sequence comes from the seed, so the server rebuilds it and replays the player's move log (`verify`): every
 * move must match, times must be human (the shared reflex floor between moves, no gap over the idle limit), and a
 * run only counts once it is over (a wrong move, the idle limit, or the whole sequence). The catalogue's
 * `minTimeMs` floor flags a clear that comes in faster than anyone could watch and repeat it, and `suspect` flags
 * move timing too regular for a person.
 */
import type { Difficulty, GameLogic, Generated, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { checkTapTimes, FLASH_PERIOD_MS, stdev } from "@/games/_shared/reflex";
import { IDLE_MS, MOVES, TAP_FLOOR_MS, type AzontoPuzzle, type AzontoSolution, type AzontoState } from "./rules";

export { IDLE_MS, MOVES };

/** Opening length, sequence length and beat per difficulty. Every beat is at least FLASH_PERIOD_MS (2 Hz cap). */
export const SHAPE_FOR: Record<Difficulty, { start: number; len: number; beatMs: number }> = {
  easy: { start: 1, len: 30, beatMs: 750 },
  medium: { start: 2, len: 32, beatMs: 650 },
  hard: { start: 3, len: 36, beatMs: 600 },
  expert: { start: 4, len: 40, beatMs: 550 },
  mega: { start: 3, len: 48, beatMs: 500 },
};

/** With this many moves logged, a spread of gaps under MIN_SPREAD_MS (standard deviation) looks scripted. */
export const SPREAD_SAMPLE = 12;
export const MIN_SPREAD_MS = 4;

/** The demonstration keeps a move lit for 60% of its beat, never less than the 250 ms off gap. */
const onFor = (beatMs: number) => Math.min(beatMs - (FLASH_PERIOD_MS - 250), Math.round(beatMs * 0.6));

/** Seeded moves; no move three times in a row, which would read as one long move. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<AzontoPuzzle, AzontoSolution> {
  const { start, len, beatMs } = SHAPE_FOR[difficulty] ?? SHAPE_FOR.easy;
  const seq: number[] = [];
  while (seq.length < len) {
    const m = rng.int(0, MOVES - 1);
    const n = seq.length;
    if (n >= 2 && seq[n - 1] === m && seq[n - 2] === m) continue;
    seq.push(m);
  }
  return { puzzle: { seq, start, beatMs, onMs: onFor(beatMs) }, solution: null, grade: grade(start, beatMs) };
}

/** Longer openings and a quicker beat are harder. */
export function grade(start: number, beatMs: number) {
  return Math.min(100, start * 15 + Math.round((800 - beatMs) / 6));
}

/** The practice round (guided first play): one, two, three, then four moves, slowly, so every move shows once. */
export function practice(): Generated<AzontoPuzzle, AzontoSolution> {
  const beatMs = 800;
  return { puzzle: { seq: [0, 2, 1, 3], start: 1, beatMs, onMs: onFor(beatMs) }, solution: null, grade: 5 };
}

export interface Replay {
  ok: boolean;
  reason?: string;
  /** longest sequence repeated in full */
  best: number;
  /** the run ended: a wrong move, the idle limit, or the whole sequence */
  over: boolean;
}

/** Replays the move log against the seeded sequence. */
export function replay(p: AzontoPuzzle, state: AzontoState): Replay {
  const fail = (reason: string): Replay => ({ ok: false, reason, best: 0, over: false });
  if (!state || !Array.isArray(state.rounds)) return fail("malformed state");
  if (!p || !Array.isArray(p.seq) || p.beatMs < FLASH_PERIOD_MS || p.onMs > p.beatMs - 250) return fail("beat faster than 2 Hz");
  let best = 0;
  for (let r = 0; r < state.rounds.length; r++) {
    const round = state.rounds[r];
    const len = p.start + r;
    if (len > p.seq.length) return fail("more rounds than moves");
    if (!round || !Array.isArray(round.taps) || round.taps.length > len) return fail("malformed round");
    for (const t of round.taps)
      if (!Array.isArray(t) || t.length !== 2 || !Number.isInteger(t[0]) || t[0] < 0 || t[0] >= MOVES) return fail("malformed move");
    const timing = checkTapTimes(
      round.taps.map((t) => t[1]),
      TAP_FLOOR_MS,
      IDLE_MS,
    );
    if (timing) return fail(timing);
    const wrong = round.taps.findIndex(([m], i) => m !== p.seq[i]);
    const last = r === state.rounds.length - 1;
    if (wrong !== -1) {
      if (!last || wrong !== round.taps.length - 1) return fail("moves after a wrong move");
      return { ok: true, best, over: true };
    }
    if (round.taps.length < len) return last ? { ok: true, best, over: true } : fail("round left unfinished");
    best = len;
  }
  return { ok: true, best, over: best === p.seq.length };
}

export function verify(p: AzontoPuzzle, _sol: AzontoSolution, state: AzontoState): VerifyResult {
  const r = replay(p, state);
  if (!r.ok) return { ok: false, progress: 0, reason: r.reason };
  const progress = r.best / p.seq.length;
  if (!r.over) return { ok: false, progress, reason: "run not finished" };
  return { ok: true, progress, score: r.best };
}

export function progress(p: AzontoPuzzle, _sol: AzontoSolution, state: AzontoState): number {
  return replay(p, state).best / p.seq.length;
}

/** Gaps between moves within each round, in order. */
function gaps(state: AzontoState): number[] {
  const out: number[] = [];
  for (const r of state?.rounds ?? []) {
    let prev = 0;
    for (const [, ms] of r?.taps ?? []) {
      out.push(ms - prev);
      prev = ms;
    }
  }
  return out;
}

/** Move timing too even for a person (a script replaying the sequence). */
export function suspect(_p: AzontoPuzzle, _sol: AzontoSolution, state: AzontoState): string | null {
  const g = gaps(state);
  return g.length >= SPREAD_SAMPLE && stdev(g) < MIN_SPREAD_MS ? "move timing too regular" : null;
}

const logic: GameLogic<AzontoPuzzle, AzontoSolution, AzontoState> = {
  id: "azonto",
  generate,
  practice,
  verify,
  progress,
  suspect,
};
export default logic;
