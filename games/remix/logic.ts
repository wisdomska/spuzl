/**
 * Remix: unscramble three words (5, 6 and 7 letters) against the clock. The scrambles go to the client;
 * the words stay on the server. Any real word that uses exactly the letters counts.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { isWord } from "@/games/_shared/words";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import { isAnagram, ROUNDS, type RemixCheck, type RemixGuess, type RemixPuzzle, type RemixSolution, type RemixState } from "./rules";

export const contentCount = CONTENT.length;

const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 45, expert: 55, mega: 65 };

/** Shuffles until the scramble is not a word and moves at least half the letters. */
export function scramble(word: string, rng: Rng): string[] {
  let best = [...word].reverse();
  for (let t = 0; t < 60; t++) {
    const s = rng.shuffle([...word]);
    const moved = s.filter((ch, i) => ch !== word[i]).length;
    if (moved >= Math.ceil(word.length / 2) && !isWord(s.join(""))) return s;
    if (s.join("") !== word) best = s;
  }
  return best;
}

export function grade(words: string[], d: Difficulty): number {
  const len = words.reduce((a, w) => a + w.length, 0) / words.length;
  return Math.max(0, Math.min(100, DAY_WEIGHT[d] + Math.round(len * 2)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<RemixPuzzle, RemixSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const words = CONTENT[i].words.slice();
  const rng = createRng(`remix:${i}:${difficulty}`);
  const puzzle: RemixPuzzle = { ref: { game: "remix", i, d: difficulty }, rounds: words.map((w) => ({ letters: scramble(w, rng) })) };
  if (difficulty === "easy") puzzle.starts = words.map((w) => w[0]);
  return { puzzle, solution: { words }, grade: grade(words, difficulty) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<RemixPuzzle, RemixSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** The day's word, or any real word from exactly the same letters. */
export function checkGuess(p: RemixPuzzle, s: RemixSolution, g: RemixGuess): RemixCheck {
  if (!g || !Number.isInteger(g.round) || g.round < 0 || g.round >= ROUNDS || typeof g.word !== "string") return { ok: false };
  const word = g.word.toUpperCase();
  if (!isAnagram(p.rounds[g.round].letters, word)) return { ok: false };
  return { ok: word === s.words[g.round] || isWord(word) };
}

function solvedCount(p: RemixPuzzle, s: RemixSolution, st: RemixState): number {
  if (!st || !Array.isArray(st.answers)) return -1;
  let n = 0;
  for (let r = 0; r < Math.min(ROUNDS, st.answers.length); r++) {
    if (!checkGuess(p, s, { round: r, word: st.answers[r] }).ok) break;
    n++;
  }
  return n;
}

export function progress(p: RemixPuzzle, s: RemixSolution, st: RemixState): number {
  return Math.max(0, solvedCount(p, s, st)) / ROUNDS;
}

export function verify(p: RemixPuzzle, s: RemixSolution, st: RemixState): VerifyResult {
  const n = solvedCount(p, s, st);
  if (n < 0 || st.answers.length > ROUNDS) return { ok: false, progress: 0, reason: "malformed state" };
  return n === ROUNDS ? { ok: true, progress: 1 } : { ok: false, progress: n / ROUNDS, reason: "incomplete" };
}

/** First letter of the current round's word (second letter too on easy days, which already show the first). */
export function hint(p: RemixPuzzle, s: RemixSolution, st: RemixState): Hint | null {
  const r = Math.max(0, solvedCount(p, s, st));
  if (r >= ROUNDS) return null;
  const w = s.words[r];
  const k = p.starts ? 2 : 1;
  return { target: { round: r, prefix: w.slice(0, k) }, text: `Round ${r + 1} starts with ${w.slice(0, k)}.` };
}

const logic: GuessLogic<RemixPuzzle, RemixSolution, RemixState, RemixGuess, RemixCheck> = {
  id: "remix",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
