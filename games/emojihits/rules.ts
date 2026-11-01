/** Emoji Hits rules shared by the board and the logic. No titles: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";
import { closeEnough } from "@/games/_shared/cluecave";

export const ROUNDS = 5;
export const OPTIONS = 4;
/** tries per round, typed or picked */
export const TRIES = 3;
/** each round's time limit (a progress bar, never a second clock) */
export const LIMIT_MS = 45000;
/** nobody reads a row of emoji and answers in under this */
export const READ_FLOOR_MS = 800;

export type HitKind = "song" | "film" | "tv";

export interface HitRound {
  emoji: string;
  kind: HitKind;
  /** words in the title, as a gentle nudge */
  words: number;
  /** easy days only: four titles to pick from */
  options?: string[];
}

export interface EmojiPuzzle {
  ref: PuzzleRef;
  rounds: HitRound[];
  limitMs: number;
  tries: number;
}

export interface EmojiSolution {
  /** per round: the title, then other accepted forms */
  answers: string[][];
  /** per round: one-line hint */
  clues: string[];
}

/** A try is typed text, or (easy) the index of a picked option. */
export type HitTry = string | number;

export interface RoundLog {
  tries: HitTry[];
  /** ms from the round appearing to its last try, or the full limit on a timeout or a skip */
  ms: number;
}

export interface EmojiState {
  /** finished rounds, in order */
  rounds: RoundLog[];
  /** tries so far in the round being played (autosave only; verify ignores it) */
  current?: HitTry[];
}

export type EmojiGuess = { round: number; answer: HitTry } | { round: number; reveal: true };

export type EmojiCheck = { ok: true; title: string } | { ok: false; invalid?: true } | { reveal: string };

/** One found title: 100, plus up to 50 for speed, minus 20 per wrong try before it (never below 40). */
export function roundScore(wrong: number, ms: number, limitMs: number): number {
  return Math.max(40, 100 + Math.round((50 * (limitMs - ms)) / limitMs) - 20 * wrong);
}

const LEADING = /^(the|a|an) /;

/**
 * Forgiving title key: case, accents, punctuation, "&" for "and", spacing and a leading "the" (or "a")
 * are ignored. "The Lion King!", "lion king" and "LION-KING" all give "lionking".
 */
export function titleKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(LEADING, "")
    .replace(/ /g, "");
}

/** Typed text matches any accepted form, allowing a small typo on longer titles. */
export function titleMatches(typed: string, accepted: string[]): boolean {
  const k = titleKey(typed);
  if (!k) return false;
  return accepted.some((a) => {
    const t = titleKey(a);
    return k === t || (t.length >= 6 && closeEnough(k, t));
  });
}

export const isTry = (t: unknown): t is HitTry =>
  (typeof t === "string" && t.length > 0 && t.length <= 80) || (typeof t === "number" && Number.isInteger(t) && t >= 0 && t < OPTIONS);
