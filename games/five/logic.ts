/**
 * Five: find the hidden 5-letter word in 6 tries. Each counted guess gets a mark per letter (right spot,
 * in the word, not in it). The answer stays on the server: the board sends each word through the guess
 * transport and gets the marks back. Words the dictionary does not know are refused without spending a try.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessContext, GuessLogic } from "@/games/_shared/guess";
import { isWord } from "@/games/_shared/words";
import { FIVE_COPY } from "@/lib/copy/five";
import { createRng, type Rng } from "@/lib/rng";
import { ANSWERS } from "./content";
import {
  HIT,
  isFiveWord,
  LEN,
  markGuess,
  TRIES,
  type FiveCheck,
  type FiveGuess,
  type FivePuzzle,
  type FiveSolution,
  type FiveState,
} from "./rules";

export const contentCount = ANSWERS.length;

/** Rough English letter frequency rank (common first): rarer letters make a word harder to find. */
const COMMON = "ESIARNTOLCDUGPMHBYFVKWZXQJ";
const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 40, expert: 50, mega: 60 };

const distinct = (w: string) => new Set(w).size === w.length;

/** Easy days only use words with five different letters; every other day may repeat a letter. */
const POOLS: Record<Difficulty, readonly string[]> = (() => {
  const easy = ANSWERS.filter(distinct);
  const shuffle = (list: readonly string[], salt: string) => createRng(`five:order:${salt}`).shuffle(list.slice());
  const all = shuffle(ANSWERS, "all");
  return { easy: shuffle(easy, "easy"), medium: all, hard: all, expert: all, mega: all };
})();

export function grade(word: string, d: Difficulty): number {
  const rarity = [...word].reduce((a, ch) => a + COMMON.indexOf(ch), 0) / word.length;
  const repeats = word.length - new Set(word).size;
  return Math.max(0, Math.min(100, Math.round(DAY_WEIGHT[d] + rarity * 1.5 + repeats * 8)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<FivePuzzle, FiveSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const pool = POOLS[difficulty];
  const answer = pool[i % pool.length];
  return {
    puzzle: { ref: { game: "five", i, d: difficulty }, len: LEN, tries: TRIES },
    solution: { answer },
    grade: grade(answer, difficulty),
  };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<FivePuzzle, FiveSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

/** A counted guess: five letters and a dictionary word. */
export const validWord = (w: unknown): w is string => isFiveWord(w) && isWord(w);

/** Move log entries Five keeps on an attempt: each counted word the server checked, and a shown answer. */
type FiveEntry = { w: string } | { reveal: true };
const entries = (log: unknown[]) => log.filter((e): e is FiveEntry => !!e && typeof e === "object");
const checkedWords = (log: unknown[]) => new Set(entries(log).flatMap((e) => ("w" in e && typeof e.w === "string" ? [e.w] : [])));
const revealed = (log: unknown[]) => entries(log).some((e) => "reveal" in e && e.reveal === true);

/**
 * Pure check of one guess, for the server guess API. The answer is shown only after six counted misses, sent
 * as proof: on an attempt every one of them must be a word the server checked for it (its move log); on the
 * practice board the proof alone will do; with no context it is refused.
 */
export function checkGuess(_p: FivePuzzle, s: FiveSolution, guess: FiveGuess, ctx: GuessContext = null): FiveCheck {
  if (guess && typeof guess === "object" && Array.isArray(guess.reveal)) {
    const list = guess.reveal;
    const lost = list.length === TRIES && list.every((w) => validWord(w) && w !== s.answer);
    if (!lost || !ctx) return { ok: false, refused: true };
    if (ctx.kind === "attempt") {
      const seen = checkedWords(ctx.log);
      if (!list.every((w) => seen.has(w))) return { ok: false, refused: true };
    }
    return { reveal: s.answer };
  }
  const word = typeof guess === "string" ? guess.toUpperCase() : "";
  if (!isFiveWord(word)) return { ok: false, invalid: "length" };
  if (!isWord(word)) return { ok: false, invalid: "word" };
  return { ok: word === s.answer, word, marks: markGuess(word, s.answer) };
}

/** Kept on the attempt: a counted word the first time it is checked, and the answer once it is shown. */
export function record(_p: FivePuzzle, _s: FiveSolution, _g: FiveGuess, res: FiveCheck, log: unknown[]): FiveEntry | null {
  if ("reveal" in res) return revealed(log) ? null : { reveal: true };
  if ("marks" in res) return checkedWords(log).has(res.word) ? null : { w: res.word };
  return null;
}

/** A clear after the answer was shown is not a clear. */
export function audit(_p: FivePuzzle, _s: FiveSolution, _state: FiveState, log: unknown[]): string | null {
  return revealed(log) ? "answer shown before the clear" : null;
}

interface Replay {
  solved: boolean;
  bad: boolean;
  /** positions already found in their right spot */
  found: Set<number>;
  tries: number;
}

export function replay(s: FiveSolution, state: FiveState): Replay {
  const out: Replay = { solved: false, bad: false, found: new Set(), tries: 0 };
  if (!state || typeof state !== "object" || !Array.isArray(state.guesses)) return { ...out, bad: !!state };
  for (const g of state.guesses) {
    if (out.solved || out.tries >= TRIES || !validWord(g)) return { ...out, bad: true };
    out.tries++;
    markGuess(g, s.answer).forEach((m, k) => m === HIT && out.found.add(k));
    if (g === s.answer) out.solved = true;
  }
  return out;
}

/** A clear: the last counted guess is the answer, within six tries, and every guess is a real word. */
export function verify(_p: FivePuzzle, s: FiveSolution, state: FiveState): VerifyResult {
  const r = replay(s, state);
  if (r.bad) return { ok: false, progress: 0, reason: "malformed, not a word, or played past the end" };
  if (r.solved) return { ok: true, progress: 1 };
  return { ok: false, progress: progressOf(r), reason: r.tries >= TRIES ? "out of tries" : "incomplete" };
}

/** Share of spots found, never the letters themselves. */
const progressOf = (r: Replay) => (r.solved ? 1 : (r.found.size / LEN) * 0.8);

export function progress(_p: FivePuzzle, s: FiveSolution, state: FiveState): number {
  const r = replay(s, state);
  return r.bad ? 0 : progressOf(r);
}

/** Shows the letter of the leftmost spot no guess (and no earlier hint) has found yet. */
export function hint(_p: FivePuzzle, s: FiveSolution, state: FiveState): Hint | null {
  const r = replay(s, state ?? { guesses: [] });
  if (r.bad || r.solved || r.tries >= TRIES) return null;
  const hinted = new Set(Array.isArray(state?.hinted) ? state.hinted : []);
  for (let k = 0; k < LEN; k++) {
    if (r.found.has(k) || hinted.has(k)) continue;
    const letter = s.answer[k];
    return { target: { pos: k, letter }, text: FIVE_COPY.hint(k + 1, letter, r.tries > 0) };
  }
  return null;
}

const logic: GuessLogic<FivePuzzle, FiveSolution, FiveState, FiveGuess, FiveCheck> = {
  id: "five",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  record,
  audit,
  verify,
  progress,
  hint,
};
export default logic;
