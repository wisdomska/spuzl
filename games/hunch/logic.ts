/**
 * Hunch: guess the hidden category from up to 5 clues, opened one at a time.
 * Clue 1 is free; each extra clue costs 20 and each wrong guess 5. Six guesses in all.
 */
import type { ContentLogic, Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { closeEnough, normaliseGuess, puzzleKey, rotation, seal } from "@/games/_shared/cluecave";
import { CONTENT, type HunchSet } from "./content";

export const CLUES = 5;
export const MAX_GUESSES = 6;
export const CLUE_COST = 20;
export const MISS_COST = 5;

/** What the board unseals for instant feedback. The server never trusts it. */
export interface HunchSealed {
  category: string;
  accept: string[];
  warm: string[];
  /** clues 2..5 */
  more: string[];
}

export interface HunchPuzzle {
  /** content index, also the seal key salt */
  ref: string;
  first: string;
  sealed: string;
  maxGuesses: number;
}
export interface HunchSolution {
  category: string;
  accept: string[];
  warm: string[];
}
export interface HunchState {
  /** clues open, 1..5 */
  opened: number;
  /** every guess submitted, in order */
  guesses: string[];
}

export type GuessResult = "right" | "warm" | "cold";

/** Matches a guess: whole phrase close enough, or every answer word found among the guess words with at most one extra word. */
export function judge(guess: string, accept: string[], warm: string[]): GuessResult {
  const g = normaliseGuess(guess);
  if (!g.length) return "cold";
  const joined = g.join(" ");
  for (const a of accept) {
    const at = normaliseGuess(a);
    if (!at.length) continue;
    if (closeEnough(joined, at.join(" "))) return "right";
    const allFound = at.every((w) => g.some((x) => closeEnough(x, w)));
    if (allFound && g.length <= at.length + 1) return "right";
  }
  const hot = [...warm.flatMap(normaliseGuess), ...accept.flatMap(normaliseGuess)];
  return g.some((x) => hot.some((w) => closeEnough(x, w))) ? "warm" : "cold";
}

export function scoreFor(opened: number, misses: number) {
  return Math.max(10, 100 - CLUE_COST * (opened - 1) - MISS_COST * misses);
}

export const sealKey = (ref: string) => puzzleKey("hunch", ref);

function build(set: HunchSet, index: number): Generated<HunchPuzzle, HunchSolution> {
  const ref = `${index}:${set.id}`;
  const sealed: HunchSealed = { category: set.category, accept: set.accept, warm: set.warm, more: set.clues.slice(1) };
  return {
    puzzle: { ref, first: set.clues[0], sealed: seal(sealed, sealKey(ref)), maxGuesses: MAX_GUESSES },
    solution: { category: set.category, accept: set.accept, warm: set.warm },
    grade: gradeOf(set),
  };
}

/** Tier sets the base; long multiword answers are a touch harder to name. */
export function gradeOf(set: HunchSet) {
  return Math.min(100, set.tier * 30 - 10 + Math.min(10, set.accept[0].length));
}

const TIER_FOR: Record<Difficulty, number[]> = { easy: [1], medium: [1, 2], hard: [2, 3], expert: [3], mega: [3] };

export const contentCount = CONTENT.length;

/** Daily: one set per day from a fixed permutation, so consecutive days never repeat. Every set suits any weekday. */
export function generateAt(index: number): Generated<HunchPuzzle, HunchSolution> {
  const i = rotation(CONTENT.length, 1, index, "hunch")[0];
  return build(CONTENT[i], i);
}

/** Free play: any set whose tier suits the difficulty. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<HunchPuzzle, HunchSolution> {
  const tiers = TIER_FOR[difficulty];
  const pool = CONTENT.map((s, i) => [s, i] as const).filter(([s]) => tiers.includes(s.tier));
  const [set, i] = rng.pick(pool);
  return build(set, i);
}

function malformed(state: HunchState, maxGuesses: number): string | null {
  if (!state || typeof state !== "object") return "malformed state";
  if (!Number.isInteger(state.opened) || state.opened < 1 || state.opened > CLUES) return "bad clue count";
  if (!Array.isArray(state.guesses) || state.guesses.length > maxGuesses) return "bad guesses";
  if (state.guesses.some((g) => typeof g !== "string" || g.length > 80)) return "bad guess";
  return null;
}

export function verify(p: HunchPuzzle, sol: HunchSolution, state: HunchState): VerifyResult {
  const bad = malformed(state, p.maxGuesses);
  if (bad) return { ok: false, progress: 0, reason: bad };
  const results = state.guesses.map((g) => judge(g, sol.accept, sol.warm));
  const hit = results.indexOf("right");
  if (hit === -1) return { ok: false, progress: 0, reason: state.guesses.length >= p.maxGuesses ? "out of guesses" : "unsolved" };
  if (hit !== results.length - 1) return { ok: false, progress: 0, reason: "guesses after the right answer" };
  return { ok: true, progress: 1, score: scoreFor(state.opened, hit) };
}

/** Only the end matters for Hunch; partial progress would leak how close a guess was. */
export function progress(p: HunchPuzzle, sol: HunchSolution, state: HunchState): number {
  return verify(p, sol, state).ok ? 1 : 0;
}

/** First hint: the first letter. Later: the letter count. Never the word. */
export function hint(p: HunchPuzzle, sol: HunchSolution, state: HunchState): Hint | null {
  if (malformed(state, p.maxGuesses) || verify(p, sol, state).ok) return null;
  const word = normaliseGuess(sol.accept[0]).join(" ");
  const first = word[0].toUpperCase();
  const letters = word.replace(/ /g, "").length;
  return { target: "guess", text: `The key word starts with ${first} and has ${letters} letters.` };
}

const logic: ContentLogic<HunchPuzzle, HunchSolution, HunchState> = {
  id: "hunch",
  contentCount,
  generateAt,
  generate,
  verify,
  progress,
  hint,
};
export default logic;
