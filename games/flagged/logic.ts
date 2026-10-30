/**
 * Flagged: 10 fast rounds of flags, capitals and currencies, 10 seconds each, tap one of 4.
 * Scored like Quickfire: 100 per right answer plus up to 50 for speed.
 */
import type { ContentLogic, Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import { createRng, type Rng } from "@/lib/rng";
import { checkTimedAnswers, puzzleKey, rotation, seal, timedScore, type TimedAnswer } from "@/games/_shared/cluecave";
import { CONTENT, type Country, type FlagSpec } from "./content";

export const ROUNDS = 10;
export const OPTIONS = 4;
export const LIMIT_MS = 10000;
/** Rounds of each kind in a Daily */
export const MIX = { flag: 3, capital: 4, currency: 3 } as const;
/** Days of Daily packs offered to the scheduler. The pools rotate, so no item repeats on consecutive days. */
export const DAYS = 60;

export type RoundKind = "flag" | "capital" | "currency";
export interface FlaggedRound {
  kind: RoundKind;
  /** the country asked about (capital and currency rounds) */
  country?: string;
  /** the flag to name (flag rounds) */
  flag?: FlagSpec;
  choices: string[];
}
export interface FlaggedPuzzle {
  ref: string;
  rounds: FlaggedRound[];
  limitMs: number;
  sealed: string;
}
export interface FlaggedSolution {
  correct: number[];
}
export interface FlaggedState {
  answers: TimedAnswer[];
}

export const sealKey = (ref: string) => puzzleKey("flagged", ref);

const POOLS: Record<RoundKind, Country[]> = {
  flag: CONTENT.filter((c) => c.flag),
  capital: CONTENT.filter((c) => c.capital),
  currency: CONTENT.filter((c) => c.currency),
};

const answerOf = (kind: RoundKind, c: Country) => (kind === "flag" ? c.name : kind === "capital" ? c.capital! : c.currency!);

/** Three distinct wrong options, from the same continent first so rounds are not giveaways. */
function distractors(kind: RoundKind, c: Country, rng: Rng): string[] {
  const right = answerOf(kind, c);
  const others = rng.shuffle(POOLS[kind].filter((o) => o !== c));
  const near = others.filter((o) => o.continent === c.continent);
  const out: string[] = [];
  for (const o of [...near, ...others]) {
    const a = answerOf(kind, o);
    if (a !== right && !out.includes(a)) out.push(a);
    if (out.length === OPTIONS - 1) break;
  }
  return out;
}

function build(items: [RoundKind, Country][], ref: string, difficulty: Difficulty): Generated<FlaggedPuzzle, FlaggedSolution> {
  const rng = createRng(`flagged:${ref}`);
  const correct: number[] = [];
  const rounds = items.map(([kind, c]) => {
    const choices = rng.shuffle([answerOf(kind, c), ...distractors(kind, c, rng)]);
    correct.push(choices.indexOf(answerOf(kind, c)));
    return kind === "flag" ? { kind, flag: c.flag, choices } : { kind, country: c.name, choices };
  });
  return {
    puzzle: { ref, rounds, limitMs: LIMIT_MS, sealed: seal(correct, sealKey(ref)) },
    solution: { correct },
    grade: gradeOf(items, difficulty),
  };
}

const LIMIT_FOR: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2, expert: 3, mega: 3 };

/** Flags and currencies are harder than capitals, and countries far from home are harder. */
export function gradeOf(items: [RoundKind, Country][], difficulty: Difficulty) {
  const w = { flag: 1.2, capital: 1, currency: 1.4 };
  const far = items.filter(([, c]) => c.continent !== "africa" && c.continent !== "europe").length;
  const base = items.reduce((a, [k]) => a + w[k], 0) / items.length;
  return Math.min(100, Math.round(base * 30 + far * 2 + LIMIT_FOR[difficulty] * 10));
}

export const contentCount = DAYS;

/** Daily: each pool rotates on its own permutation; the rounds are then mixed in a seeded order. */
export function generateAt(index: number, difficulty: Difficulty = "medium"): Generated<FlaggedPuzzle, FlaggedSolution> {
  const items: [RoundKind, Country][] = [];
  for (const kind of ["flag", "capital", "currency"] as RoundKind[]) {
    for (const i of rotation(POOLS[kind].length, MIX[kind], index, `flagged:${kind}`)) items.push([kind, POOLS[kind][i]]);
  }
  createRng(`flagged-order:${index}`).shuffle(items);
  return build(items, `d${index}`, difficulty);
}

/** Free play: harder difficulties lean on flags and currencies. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<FlaggedPuzzle, FlaggedSolution> {
  const hard = LIMIT_FOR[difficulty];
  const mix: Record<RoundKind, number> = { flag: 3 + Math.min(1, hard), capital: 4 - Math.min(2, hard), currency: 3 + Math.max(0, Math.min(1, hard - 1)) };
  const items: [RoundKind, Country][] = [];
  for (const kind of ["flag", "capital", "currency"] as RoundKind[]) {
    for (const c of rng.shuffle(POOLS[kind].slice()).slice(0, mix[kind])) items.push([kind, c]);
  }
  rng.shuffle(items);
  return build(items, `f${rng.int(0, 1e9)}`, difficulty);
}

export function verify(p: FlaggedPuzzle, sol: FlaggedSolution, state: FlaggedState): VerifyResult {
  const bad = checkTimedAnswers(state?.answers, p.rounds.length, OPTIONS, p.limitMs);
  if (bad) return { ok: false, progress: progress(p, sol, state), reason: bad };
  return { ok: true, progress: 1, score: timedScore(state.answers, sol.correct, p.limitMs).score };
}

export function progress(p: FlaggedPuzzle, _sol: FlaggedSolution, state: FlaggedState): number {
  const n = Array.isArray(state?.answers) ? Math.min(state.answers.length, p.rounds.length) : 0;
  return n / p.rounds.length;
}

/** 50:50 on the current round. */
export function hint(p: FlaggedPuzzle, sol: FlaggedSolution, state: FlaggedState): Hint | null {
  const i = Array.isArray(state?.answers) ? state.answers.length : 0;
  if (i >= p.rounds.length) return null;
  const wrong = [0, 1, 2, 3].filter((k) => k !== sol.correct[i]);
  const drop = createRng(`flagged-hint:${p.ref}:${i}`).shuffle(wrong).slice(0, 2).sort();
  return { target: { question: i, remove: drop }, text: "Two wrong answers are gone." };
}

const logic: ContentLogic<FlaggedPuzzle, FlaggedSolution, FlaggedState> = {
  id: "flagged",
  contentCount,
  generateAt,
  generate,
  verify,
  progress,
  hint,
};
export default logic;
