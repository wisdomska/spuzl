/**
 * Quickfire: 5 trivia questions, 15 seconds each, tap one of 4 answers.
 * 100 per right answer plus up to 50 for speed. The hint is a 50:50 on the current question.
 */
import type { ContentLogic, Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import { createRng, type Rng } from "@/lib/rng";
import { checkTimedAnswers, puzzleKey, rotation, seal, timedScore, type TimedAnswer } from "@/games/_shared/cluecave";
import { CONTENT, type QuickfireCategory, type QuickfireItem } from "./content";

export const QUESTIONS = 5;
export const OPTIONS = 4;
export const LIMIT_MS = 15000;

export interface QuickfireQuestion {
  q: string;
  cat: QuickfireCategory;
  choices: string[];
}
export interface QuickfirePuzzle {
  ref: string;
  questions: QuickfireQuestion[];
  limitMs: number;
  /** sealed correct indexes, for instant feedback only */
  sealed: string;
}
export interface QuickfireSolution {
  correct: number[];
}
export interface QuickfireState {
  answers: TimedAnswer[];
}

export const sealKey = (ref: string) => puzzleKey("quickfire", ref);

const LEVELS_FOR: Record<Difficulty, number[]> = { easy: [1], medium: [1, 2], hard: [2, 3], expert: [3, 2], mega: [1, 2, 3] };

function build(items: QuickfireItem[], ref: string): Generated<QuickfirePuzzle, QuickfireSolution> {
  const rng = createRng(`qf-choices:${ref}`);
  const correct: number[] = [];
  const questions = items.map((it) => {
    const choices = rng.shuffle([it.answer, ...it.wrong]);
    correct.push(choices.indexOf(it.answer));
    return { q: it.q, cat: it.cat, choices };
  });
  return {
    puzzle: { ref, questions, limitMs: LIMIT_MS, sealed: seal(correct, sealKey(ref)) },
    solution: { correct },
    grade: gradeOf(items),
  };
}

/** Mean question level mapped onto 0..100. */
export function gradeOf(items: QuickfireItem[]) {
  const mean = items.reduce((a, it) => a + it.level, 0) / items.length;
  return Math.round(((mean - 1) / 2) * 80 + 10);
}

export const contentCount = Math.floor(CONTENT.length / QUESTIONS);

/** Daily: five consecutive slots of a fixed permutation, so no question repeats on consecutive days. */
export function generateAt(index: number): Generated<QuickfirePuzzle, QuickfireSolution> {
  const picks = rotation(CONTENT.length, QUESTIONS, index, "quickfire");
  return build(
    picks.map((i) => CONTENT[i]),
    `d${index}`,
  );
}

/** Free play: five questions at the difficulty's levels, at most two from one category. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<QuickfirePuzzle, QuickfireSolution> {
  const levels = LEVELS_FOR[difficulty];
  const pool = rng.shuffle(CONTENT.filter((it) => levels.includes(it.level)));
  const picked: QuickfireItem[] = [];
  for (const it of pool) {
    if (picked.length === QUESTIONS) break;
    if (picked.filter((x) => x.cat === it.cat).length < 2) picked.push(it);
  }
  return build(picked, `f${rng.int(0, 1e9)}`);
}

export function verify(p: QuickfirePuzzle, sol: QuickfireSolution, state: QuickfireState): VerifyResult {
  const bad = checkTimedAnswers(state?.answers, p.questions.length, OPTIONS, p.limitMs);
  if (bad) return { ok: false, progress: progress(p, sol, state), reason: bad };
  return { ok: true, progress: 1, score: timedScore(state.answers, sol.correct, p.limitMs).score };
}

/** Questions answered, never which were right. */
export function progress(p: QuickfirePuzzle, _sol: QuickfireSolution, state: QuickfireState): number {
  const n = Array.isArray(state?.answers) ? Math.min(state.answers.length, p.questions.length) : 0;
  return n / p.questions.length;
}

/** 50:50 on the current question: names two wrong choices to strike out. */
export function hint(p: QuickfirePuzzle, sol: QuickfireSolution, state: QuickfireState): Hint | null {
  const i = Array.isArray(state?.answers) ? state.answers.length : 0;
  if (i >= p.questions.length) return null;
  const wrong = [0, 1, 2, 3].filter((k) => k !== sol.correct[i]);
  const drop = createRng(`qf-hint:${p.ref}:${i}`).shuffle(wrong).slice(0, 2).sort();
  return { target: { question: i, remove: drop }, text: "Two wrong answers are gone." };
}

const logic: ContentLogic<QuickfirePuzzle, QuickfireSolution, QuickfireState> = {
  id: "quickfire",
  contentCount,
  generateAt,
  generate,
  verify,
  progress,
  hint,
};
export default logic;
