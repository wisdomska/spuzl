/**
 * Twins: flip two cards a turn to find every pair, in the fewest flips.
 * A memory game has to show its layout to the client, so the server cannot hide it. Instead it
 * replays the flip log and rejects runs that are too lucky: matches made by flipping a card nobody
 * had seen yet happen about once a game by chance, and a run full of them means the player could
 * see the faces.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { checkTapTimes, HUMAN_FLOOR_MS } from "@/games/_shared/reflex";

/** Card glyphs (Phosphor names). Every face is a distinct shape, so colour is never the only cue. */
export const FACES = [
  "star", "heart", "moon", "sun", "leaf", "drop", "fire", "lightning", "flag", "bell", "crown-simple", "key",
  "music-note", "planet", "anchor-simple", "rocket", "snowflake", "cube", "gift", "trophy", "horse", "ghost", "pepper", "tree",
] as const;

export const GRID_FOR: Record<Difficulty, { rows: number; cols: number }> = {
  easy: { rows: 3, cols: 4 },
  medium: { rows: 4, cols: 4 },
  hard: { rows: 5, cols: 4 },
  expert: { rows: 6, cols: 5 },
  mega: { rows: 6, cols: 6 },
};

export interface TwinsPuzzle {
  rows: number;
  cols: number;
  /** index into FACES per card, row-major; each appears exactly twice */
  faces: number[];
}
/** The layout is public by nature; there is no secret. */
export type TwinsSolution = null;
export interface TwinsState {
  /** [card index, ms since the first flip] */
  flips: [number, number][];
}

export const pairsOf = (p: TwinsPuzzle) => p.faces.length / 2;

export function generate(rng: Rng, difficulty: Difficulty): Generated<TwinsPuzzle, TwinsSolution> {
  const { rows, cols } = GRID_FOR[difficulty];
  const pairs = (rows * cols) / 2;
  const chosen = rng.shuffle(FACES.map((_, i) => i)).slice(0, pairs);
  const faces = rng.shuffle([...chosen, ...chosen]);
  return { puzzle: { rows, cols, faces }, solution: null, grade: grade(pairs) };
}

/** Pairs to remember drive difficulty. */
export function grade(pairs: number) {
  return Math.min(100, Math.round(pairs * 5.5));
}

/** Blind matches above this are flagged as implausible. */
export const luckLimit = (pairs: number) => 2 + Math.ceil(pairs / 4);

export interface TwinsReplay {
  ok: boolean;
  reason?: string;
  matched: number;
  flips: number;
  /** matches made by turning over a card never seen before */
  blind: number;
  /** cards matched so far */
  done: Set<number>;
  /** cards seen at least once */
  seen: Set<number>;
  /** the face-up card of an unfinished turn */
  open: number | null;
}

export function replay(p: TwinsPuzzle, state: TwinsState): TwinsReplay {
  const done = new Set<number>();
  const seen = new Set<number>();
  const base = { matched: 0, flips: 0, blind: 0, done, seen, open: null };
  const fail = (reason: string): TwinsReplay => ({ ...base, ok: false, reason });
  if (!state || !Array.isArray(state.flips)) return fail("malformed state");
  const n = p.faces.length;
  for (const f of state.flips) if (!Array.isArray(f) || f.length !== 2 || !Number.isInteger(f[0]) || f[0] < 0 || f[0] >= n) return fail("malformed flip");
  // The clock starts at the first flip; every later flip is at least the human floor after the one before.
  if (state.flips.length && state.flips[0][1] !== 0) return fail("first flip must be at 0 ms");
  const timing = checkTapTimes(state.flips.slice(1).map((f) => f[1]), HUMAN_FLOOR_MS);
  if (timing) return fail(timing);
  let matched = 0, blind = 0;
  let open: number | null = null;
  for (const [card] of state.flips) {
    if (done.has(card)) return fail("flipped a matched card");
    if (open === null) {
      open = card;
      seen.add(card);
      continue;
    }
    if (card === open) return fail("flipped the same card twice");
    const fresh = !seen.has(card);
    seen.add(card);
    if (p.faces[card] === p.faces[open]) {
      done.add(card);
      done.add(open);
      matched++;
      if (fresh) blind++;
    }
    open = null;
  }
  return { ok: true, matched, flips: state.flips.length, blind, done, seen, open };
}

export function scoreFor(pairs: number, flips: number) {
  return Math.max(10, Math.round((1000 * 2 * pairs) / flips));
}

export function verify(p: TwinsPuzzle, _sol: TwinsSolution, state: TwinsState): VerifyResult {
  const r = replay(p, state);
  if (!r.ok) return { ok: false, progress: 0, reason: r.reason };
  const pairs = pairsOf(p);
  const progress = r.matched / pairs;
  if (r.matched < pairs) return { ok: false, progress, reason: "pairs left" };
  if (r.blind > luckLimit(pairs)) return { ok: false, progress, reason: "too many blind matches" };
  return { ok: true, progress: 1, score: scoreFor(pairs, r.flips) };
}

export function progress(p: TwinsPuzzle, _sol: TwinsSolution, state: TwinsState): number {
  return replay(p, state).matched / pairsOf(p);
}

/** Points at one unmatched pair, preferring one the player has already half seen. */
export function hint(p: TwinsPuzzle, _sol: TwinsSolution, state: TwinsState): Hint | null {
  const r = replay(p, state);
  if (!r.ok) return null;
  let fallback: [number, number] | null = null;
  for (let i = 0; i < p.faces.length; i++) {
    if (r.done.has(i)) continue;
    const j = p.faces.findIndex((f, k) => k !== i && f === p.faces[i]);
    if (r.seen.has(i) || r.seen.has(j)) return { target: [i, j], text: "These two are a pair." };
    fallback ??= [i, j];
  }
  return fallback ? { target: fallback, text: "These two are a pair." } : null;
}

const logic: GameLogic<TwinsPuzzle, TwinsSolution, TwinsState> = {
  id: "twins",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
