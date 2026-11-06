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

export type QuadsGuess = string[];

export type QuadsCheck = { ok: true; group: SolvedGroup } | { ok: false; oneAway: boolean; invalid?: boolean };

export const setKey = (words: string[]) => words.slice().sort().join("|");

export function validGuess(p: QuadsPuzzle, guess: unknown): guess is string[] {
  return (
    Array.isArray(guess) &&
    guess.length === GROUP_SIZE &&
    new Set(guess).size === GROUP_SIZE &&
    guess.every((w) => typeof w === "string" && p.words.includes(w))
  );
}
