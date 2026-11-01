/**
 * Seven: make words from seven letters, centre letter in every word, 4 letters or more. A word using all
 * seven is a Spuzl word (+7). Points: 1 for a 4 letter word, otherwise its length. Answers are every
 * fitting word in the shared list, so client and server agree; the server re-scores on verify.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { wordSet } from "@/games/_shared/words";
import { type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import {
  answersFrom,
  isPangram,
  shapeError,
  wordScore,
  type SevenCheck,
  type SevenGuess,
  type SevenPuzzle,
  type SevenSolution,
  type SevenState,
} from "./rules";

export const contentCount = CONTENT.length;

/** Share of the maximum score needed to finish, per day. */
export const TARGET: Record<Difficulty, number> = { easy: 0.2, medium: 0.3, hard: 0.4, expert: 0.5, mega: 0.6 };

export function maxScore(words: string[], centre: string, letters: string[]) {
  return words.reduce((s, w) => s + wordScore(w, isPangram(w, centre, letters)), 0);
}

export function grade(total: number, d: Difficulty): number {
  return Math.max(0, Math.min(100, Math.round(TARGET[d] * 120 + Math.min(20, total / 3))));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<SevenPuzzle, SevenSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const e = CONTENT[i];
  const letters = e.letters.split("");
  const words = answersFrom(wordSet(), e.centre, letters);
  const max = maxScore(words, e.centre, letters);
  const puzzle: SevenPuzzle = {
    ref: { game: "seven", i, d: difficulty },
    centre: e.centre,
    letters,
    total: words.length,
    maxScore: max,
    target: Math.ceil(max * TARGET[difficulty]),
  };
  return { puzzle, solution: { words }, grade: grade(words.length, difficulty) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<SevenPuzzle, SevenSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** Pure check of one word (uppercase). `found` lets the server flag repeats. */
export function checkGuess(p: SevenPuzzle, s: SevenSolution, guess: SevenGuess, found: string[] = []): SevenCheck {
  if (typeof guess !== "string") return { ok: false, reason: "word" };
  const w = guess.toUpperCase();
  const shape = shapeError(p.centre, p.letters, w);
  if (shape) return { ok: false, reason: shape };
  if (!s.words.includes(w)) return { ok: false, reason: "word" };
  if (found.includes(w)) return { ok: false, reason: "dupe" };
  const pangram = isPangram(w, p.centre, p.letters);
  return { ok: true, score: wordScore(w, pangram), pangram };
}

function tally(p: SevenPuzzle, s: SevenSolution, state: SevenState): { score: number; valid: boolean } {
  if (!state || !Array.isArray(state.found)) return { score: 0, valid: false };
  let score = 0;
  const seen: string[] = [];
  for (const w of state.found) {
    const r = checkGuess(p, s, w, seen);
    if (!r.ok) return { score, valid: false };
    seen.push(w);
    score += r.score;
  }
  return { score, valid: true };
}

export function verify(p: SevenPuzzle, s: SevenSolution, state: SevenState): VerifyResult {
  const t = tally(p, s, state);
  const max = maxScore(s.words, p.centre, p.letters);
  if (!t.valid) return { ok: false, progress: 0, score: 0, reason: "malformed or invalid word" };
  const target = p.target;
  return {
    ok: t.score >= target && t.score > 0,
    progress: Math.min(1, t.score / max),
    score: t.score,
    reason: t.score >= target ? undefined : "below target",
  };
}

export function progress(p: SevenPuzzle, s: SevenSolution, state: SevenState): number {
  const t = tally(p, s, state);
  return t.valid ? Math.min(1, t.score / maxScore(s.words, p.centre, p.letters)) : 0;
}

/** Start and length of an unfound word: the Spuzl word first if it is still hiding. */
export function hint(p: SevenPuzzle, s: SevenSolution, state: SevenState): Hint | null {
  const found = Array.isArray(state?.found) ? state.found : [];
  const left = s.words.filter((w) => !found.includes(w));
  if (!left.length) return null;
  const pg = left.find((w) => isPangram(w, p.centre, p.letters));
  const w = pg ?? left.sort((a, b) => a.length - b.length)[0];
  return {
    target: { start: w.slice(0, 2), len: w.length },
    text: `${pg ? "A Spuzl word" : "A word"} starts ${w.slice(0, 2)} and has ${w.length} letters.`,
  };
}

const logic: GuessLogic<SevenPuzzle, SevenSolution, SevenState, SevenGuess, SevenCheck> = {
  id: "seven",
  contentCount,
  generate,
  generateAt,
  // The route passes a guess context as a 4th argument; Seven's own 4th argument (found words) is internal.
  checkGuess: (p, s, g) => checkGuess(p, s, g),
  verify,
  progress,
  hint,
};
export default logic;
