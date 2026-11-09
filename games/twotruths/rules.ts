/** Two Truths and a Lie rules shared by the board and the logic. No statements: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";
import type { TimedAnswer } from "@/games/_shared/cluecave";

export const TRUTHS_THEMES = ["ghana", "westafrica", "science", "food", "football", "music", "animals", "world"] as const;
export type TruthsTheme = (typeof TRUTHS_THEMES)[number];

/** rounds per board */
export const ROUNDS = 5;
/** statements per round: two truths and a lie */
export const OPTIONS = 3;
/** each round's time limit (a progress bar in the card; the header holds the one clock) */
export const LIMIT_MS = 20000;
/** Network allowance on the server's clock, both for a late answer and for the time it scores. */
export const NET_SLACK_MS = 3000;
/** how long the answered round (with what is true instead) stays before the next one */
export const REVEAL_MS = 3200;
/** The longest the answered round waits before the next one, however long its line. */
export const REVEAL_MAX_MS = 9000;

/**
 * How long the answered round stays: long enough to read its line (the lie and what is true instead, about
 * 20 characters a second plus a beat to find it), never less than REVEAL_MS nor more than REVEAL_MAX_MS.
 */
export function revealMsFor(line: string): number {
  return Math.max(REVEAL_MS, Math.min(REVEAL_MAX_MS, 1200 + line.length * 50));
}
/** Content indexes from here up are free play boards (FREE_BASE + seed); below are Daily rotation days. */
export const FREE_BASE = 1_000_000_000;
/** The practice board's content index (just under FREE_BASE, a Daily day no schedule reaches; generateAt checks it first). */
export const PRACTICE_INDEX = 999_999_999;

export interface TruthsRoundView {
  theme: TruthsTheme;
  /** the three statements in board order; one of them is the lie */
  statements: string[];
}

export interface TruthsPuzzle {
  /** a content reference where it is built; an opaque token once served */
  ref: PuzzleRef;
  rounds: TruthsRoundView[];
  limitMs: number;
}

export interface TruthsSolution {
  /** the lie's index per round */
  lie: number[];
  /** what is true instead, per round */
  fix: string[];
}

export interface TruthsAnswer extends TimedAnswer {
  right?: boolean;
  /** the lie's index, shown after the answer */
  answer?: number;
}

export interface TruthsState {
  answers: TruthsAnswer[];
}

/** `open` when the round appears; otherwise its pick (null when the time ran out). */
export type TruthsGuess = { q: number; open: true } | { q: number; pick: number | null; ms: number };

export interface TruthsVerdict {
  q: number;
  pick: number | null;
  /** the time that scores (the limit on a timeout) */
  ms: number;
  right: boolean;
  /** the lie's index */
  answer: number;
  /** the answer reached the server after the window: it counts as a timeout */
  late: boolean;
  /** what is true instead of the lie */
  fix: string;
}

export type TruthsCheck =
  { ok: true; leftMs?: number; verdict?: TruthsVerdict } | { ok: false; refused: true } | { ok: false; invalid: true };
