/**
 * Quads: sort 16 words into 4 hidden groups of 4. The client gets the words only; groups, labels and
 * levels stay on the server. Each submitted four is checked with `checkGuess`; the fourth slip ends the game.
 * The guided practice round is a fixed board of 2 groups (practice.ts); everything here counts groups from
 * the solution, so it plays and verifies the same way.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessContext, GuessLogic } from "@/games/_shared/guess";
import { createRng, type Rng } from "@/lib/rng";
import { liveContent } from "@/games/_shared/live";
import { CONTENT, type QuadsEntry } from "./content";
import { PRACTICE_GROUPS, PRACTICE_INDEX, PRACTICE_ORDER } from "./practice";
import {
  isRevealGuess,
  setKey,
  SLIPS,
  validGuess,
  type QuadsCheck,
  type QuadsGuess,
  type QuadsPuzzle,
  type QuadsSolution,
  type QuadsState,
} from "./rules";

export const contentCount = CONTENT.length;

/** Difficulty knobs: easy names the most direct group; every day grades by authoring order and day. */
const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 45, expert: 55, mega: 65 };

export function grade(entryIndex: number, d: Difficulty, words: string[]): number {
  const longest = Math.max(...words.map((w) => w.length));
  return Math.max(0, Math.min(100, DAY_WEIGHT[d] + (entryIndex % 7) * 2 + Math.min(10, longest)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<QuadsPuzzle, QuadsSolution> {
  // Round 3 item 12: the reviewed list (retired entries left out, edited ones swapped in).
  const list = liveContent("quads", CONTENT);
  const i = ((index % list.length) + list.length) % list.length;
  return boardFor(list[i], i, difficulty, `quads:${i}:${difficulty}`);
}

/**
 * R4-15: the `ref.i` of a board dealt from the database pool (an approved item an editor put in free play). Past any
 * content.ts index, so it never names a built-in entry; attempts resolve their board from the server seed.
 */
export const POOL_INDEX = 100_000;

/** The board for one entry: its 16 words shuffled by `shuffleSeed`; groups, labels and levels stay in the solution. */
export function boardFor(entry: QuadsEntry, i: number, difficulty: Difficulty, shuffleSeed: string): Generated<QuadsPuzzle, QuadsSolution> {
  const rng = createRng(shuffleSeed);
  const words = rng.shuffle(entry.groups.flatMap((g) => g.words.slice()));
  const puzzle: QuadsPuzzle = { ref: { game: "quads", i, d: difficulty }, words };
  if (difficulty === "easy") puzzle.starter = entry.groups[0].label;
  const solution: QuadsSolution = { groups: entry.groups.map((g, level) => ({ label: g.label, words: g.words.slice(), level })) };
  return { puzzle, solution, grade: grade(i % 1000, difficulty, words) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<QuadsPuzzle, QuadsSolution> {
  return generateAt(rng.int(0, liveContent("quads", CONTENT).length - 1), difficulty);
}

/** The guided first play's board: two plain groups in a fixed order (lib/game/service.ts loadFree). */
export function practice(): Generated<QuadsPuzzle, QuadsSolution> {
  const puzzle: QuadsPuzzle = { ref: { game: "quads", i: PRACTICE_INDEX, d: "easy" }, words: PRACTICE_ORDER.slice() };
  const solution: QuadsSolution = { groups: PRACTICE_GROUPS.map((g, level) => ({ label: g.label, words: g.words.slice(), level })) };
  return { puzzle, solution, grade: 0 };
}

/** Slips the server has seen on this attempt (its move log): each wrong set of four, once. */
function loggedSlips(log: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const e of log) {
    const k = e && typeof e === "object" ? (e as { slip?: unknown }).slip : undefined;
    if (typeof k === "string") out.add(k);
  }
  return out;
}
const loggedReveal = (log: unknown[]) => log.some((e) => !!e && typeof e === "object" && (e as { reveal?: unknown }).reveal === true);

/**
 * Pure check of one set of four, for the server guess API. A reveal (the groups, easiest first) is only answered
 * once the attempt's own log holds SLIPS wrong sets, or on the practice round, whose answers are public; a bare
 * reference or a run with slips left gets nothing.
 */
export function checkGuess(p: QuadsPuzzle, s: QuadsSolution, guess: QuadsGuess, ctx: GuessContext = null): QuadsCheck {
  if (isRevealGuess(guess)) {
    const allowed = ctx?.kind === "practice" || (ctx?.kind === "attempt" && loggedSlips(ctx.log).size >= SLIPS);
    if (!allowed) return { ok: false, oneAway: false, invalid: true };
    const reveal = s.groups.map((g) => ({ label: g.label, words: g.words.slice(), level: g.level })).sort((a, b) => a.level - b.level);
    return { ok: false, oneAway: false, reveal };
  }
  if (!validGuess(p, guess)) return { ok: false, oneAway: false, invalid: true };
  const key = setKey(guess);
  const hit = s.groups.find((g) => setKey(g.words) === key);
  if (hit) return { ok: true, group: { label: hit.label, words: hit.words.slice(), level: hit.level } };
  const oneAway = s.groups.some((g) => g.words.filter((w) => guess.includes(w)).length === 3);
  return { ok: false, oneAway };
}

/** Kept on the attempt: each wrong set of four (once), and that the groups were shown. */
export function record(_p: QuadsPuzzle, _s: QuadsSolution, guess: QuadsGuess, res: QuadsCheck, log: unknown[]): unknown {
  if ("reveal" in res) return loggedReveal(log) ? null : { reveal: true };
  if (res.ok || ("invalid" in res && res.invalid) || !Array.isArray(guess)) return null;
  const key = setKey(guess);
  return loggedSlips(log).has(key) ? null : { slip: key };
}

/** Groups that were shown can't then be solved: a clear after a reveal fails. */
export function audit(_p: QuadsPuzzle, _s: QuadsSolution, _state: QuadsState, log: unknown[]): string | null {
  return loggedReveal(log) ? "groups shown before the board was solved" : null;
}

interface Replay {
  solved: number[];
  slips: number;
  bad: boolean;
}

/** Replays the guess log: repeated sets are ignored, anything after the fourth slip or the last group is invalid. */
export function replay(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): Replay {
  const out: Replay = { solved: [], slips: 0, bad: false };
  if (!state || typeof state !== "object" || !Array.isArray(state.guesses)) return { ...out, bad: true };
  const seen = new Set<string>();
  for (const g of state.guesses) {
    if (out.slips >= SLIPS || out.solved.length === s.groups.length || !validGuess(p, g)) return { ...out, bad: true };
    const key = setKey(g);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = checkGuess(p, s, g);
    if (r.ok) out.solved.push(r.group.level);
    else out.slips++;
  }
  return out;
}

export function verify(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): VerifyResult {
  const r = replay(p, s, state);
  const n = s.groups.length;
  if (r.bad) return { ok: false, progress: r.solved.length / n, reason: "malformed or played past the end" };
  if (r.solved.length === n) return { ok: true, progress: 1 };
  return { ok: false, progress: r.solved.length / n, reason: r.slips >= SLIPS ? "out of slips" : "incomplete" };
}

export function progress(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): number {
  return replay(p, s, state).solved.length / s.groups.length;
}

/** Points at two words of the most direct unsolved group, without naming the group. */
export function hint(p: QuadsPuzzle, s: QuadsSolution, state: QuadsState): Hint | null {
  const r = replay(p, s, state);
  const g = s.groups.find((x) => !r.solved.includes(x.level));
  if (!g || r.slips >= SLIPS) return null;
  const pair = g.words.slice(0, 2);
  return { target: pair, text: `${pair[0]} and ${pair[1]} belong together.` };
}

const logic: GuessLogic<QuadsPuzzle, QuadsSolution, QuadsState, QuadsGuess, QuadsCheck> = {
  id: "quads",
  contentCount,
  generate,
  generateAt,
  practice,
  checkGuess,
  record,
  audit,
  verify,
  progress,
  hint,
};
export default logic;
