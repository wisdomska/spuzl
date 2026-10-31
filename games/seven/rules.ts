/** Seven rules shared by the board and the logic. No content: safe for the client bundle. */
import type { PuzzleRef } from "@/games/_shared/guess";

export const MIN_LEN = 4;
export const PANGRAM_BONUS = 7;

export interface SevenPuzzle {
  ref: PuzzleRef;
  centre: string;
  /** the six outer letters */
  letters: string[];
  /** how many answers and points exist (for the rank bar) */
  total: number;
  maxScore: number;
  /** points needed to finish today */
  target: number;
}

export interface SevenSolution {
  words: string[];
}

export interface SevenState {
  found: string[];
}

export type SevenGuess = string;
export type SevenCheck =
  { ok: true; score: number; pangram: boolean } | { ok: false; reason: "short" | "centre" | "letters" | "word" | "dupe" };

export const RANKS = [
  { name: "Seedling", pct: 0 },
  { name: "Sprout", pct: 0.1 },
  { name: "Sapling", pct: 0.2 },
  { name: "Solid", pct: 0.3 },
  { name: "Tall tree", pct: 0.45 },
  { name: "Old baobab", pct: 0.65 },
  { name: "Whole woods", pct: 1 },
];

export function rankFor(score: number, max: number) {
  let r = RANKS[0];
  for (const x of RANKS) if (max > 0 && score >= Math.ceil(x.pct * max)) r = x;
  return r;
}

export const isPangram = (w: string, centre: string, letters: string[]) => [centre, ...letters].every((l) => w.includes(l));

export function wordScore(w: string, pangram: boolean): number {
  return (w.length === MIN_LEN ? 1 : w.length) + (pangram ? PANGRAM_BONUS : 0);
}

/** Why a word cannot count, ignoring the dictionary. Uppercase input. */
export function shapeError(centre: string, letters: string[], w: string): "short" | "centre" | "letters" | null {
  if (w.length < MIN_LEN) return "short";
  if (!w.includes(centre)) return "centre";
  const ok = new Set([centre, ...letters]);
  return [...w].every((ch) => ok.has(ch)) ? null : "letters";
}

/** Every answer in a lowercase word list, uppercased and sorted. */
export function answersFrom(list: Iterable<string>, centre: string, letters: string[]): string[] {
  const c = centre.toLowerCase();
  const ok = new Set([c, ...letters.map((l) => l.toLowerCase())]);
  const out: string[] = [];
  for (const w of list) {
    if (w.length < MIN_LEN || !w.includes(c)) continue;
    let fits = true;
    for (let i = 0; i < w.length; i++)
      if (!ok.has(w[i])) {
        fits = false;
        break;
      }
    if (fits) out.push(w.toUpperCase());
  }
  return out.sort();
}

export const REASON_COPY: Record<Exclude<SevenCheck, { ok: true }>["reason"], string> = {
  short: "Words need 4 letters or more.",
  centre: "Every word needs the centre letter.",
  letters: "Only the seven letters count.",
  word: "Not in the word list.",
  dupe: "Already found.",
};
