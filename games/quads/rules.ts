/** Quads rules shared by the board and the logic. No content, no answers: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const SLIPS = 4;
export const GROUP_SIZE = 4;
/** Difficulty levels, 0 most direct .. 3 trickiest (yellow, green, blue, purple on the board). */
export const LEVELS = 4;

/** How many groups a board holds: 4 on a real board, 2 on the practice round. */
export const groupCount = (p: { words: string[] }) => Math.max(1, Math.floor(p.words.length / GROUP_SIZE));

export interface QuadsPuzzle {
  ref: PuzzleRef;
  /** the 16 words (8 on the practice round), shuffled, with no group labels */
  words: string[];
  /** easy days name the most direct group up front */
  starter?: string;
}

export interface SolvedGroup {
  label: string;
  words: string[];
  /** 0 most direct .. 3 trickiest */
  level: number;
}

export interface QuadsSolution {
  groups: SolvedGroup[];
}

/** Every submitted set of four, in order. Solved groups and slips are derived from it. */
export interface QuadsState {
  guesses: string[][];
}

/** A set of four, or (once the slips have run out) a request to show the groups that were not found. */
export type QuadsGuess = string[] | { reveal: true };

export type QuadsCheck =
  | { ok: true; group: SolvedGroup }
  | { ok: false; oneAway: boolean; invalid?: boolean }
  /** every group, easiest first: only once the attempt's slips have run out (or on the practice round) */
  | { ok: false; oneAway: false; reveal: SolvedGroup[] };

export const isRevealGuess = (g: unknown): g is { reveal: true } =>
  !!g && typeof g === "object" && !Array.isArray(g) && (g as { reveal?: unknown }).reveal === true;

export const setKey = (words: string[]) => words.slice().sort().join("|");

export function validGuess(p: QuadsPuzzle, guess: unknown): guess is string[] {
  return (
    Array.isArray(guess) &&
    guess.length === GROUP_SIZE &&
    new Set(guess).size === GROUP_SIZE &&
    guess.every((w) => typeof w === "string" && p.words.includes(w))
  );
}

/** The smallest a word tile's text gets: long words wrap onto a second line instead of shrinking past it. */
export const WORD_MIN_PX = 14;

/** A word tile's font size, px: short words a touch larger, every other word at WORD_MIN_PX (wrapping if long). */
export const wordFont = (w: string): number => (w.length <= 6 ? 15 : WORD_MIN_PX);
