/** Quads rules shared by the board and the logic. No content, no answers: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const SLIPS = 4;

export interface QuadsPuzzle {
  ref: PuzzleRef;
  /** the 16 words, shuffled, with no group labels */
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
  return Array.isArray(guess) && guess.length === 4 && new Set(guess).size === 4 && guess.every((w) => typeof w === "string" && p.words.includes(w));
}
