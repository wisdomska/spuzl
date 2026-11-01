/**
 * Buried: a word search whose leftover letters spell a secret phrase. The generator hides as many of the
 * theme's words as fill the grid exactly to (cells minus phrase letters), each word in exactly one spot,
 * then writes the phrase into the empty squares in reading order. Bigger grids and more directions on
 * harder days.
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { isWord } from "@/games/_shared/words";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import { BURIED_COPY } from "@/lib/copy/buried";
import {
  BONUS_MIN,
  COLS,
  isStraight,
  type BuriedCheck,
  type BuriedGuess,
  type BuriedPuzzle,
  type BuriedSolution,
  type BuriedState,
  type Placement,
} from "./rules";

export const contentCount = CONTENT.length;

export const ROWS_FOR: Record<Difficulty, number> = { easy: 6, medium: 7, hard: 8, expert: 8, mega: 9 };
const ALL: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];
export const DIRS_FOR: Record<Difficulty, [number, number][]> = {
  easy: ALL.slice(0, 2),
  medium: ALL.slice(0, 4),
  hard: ALL.slice(0, 6),
  expert: ALL,
  mega: ALL,
};

/** Distinct cell sets on which `word` reads in the grid, in any of the 8 directions (either way). */
export function occurrences(letters: string[], rows: number, cols: number, word: string): number {
  const keys = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of ALL) {
        const cells: number[] = [];
        for (let k = 0; k < word.length; k++) {
          const rr = r + dr * k,
            cc = c + dc * k;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols || letters[rr * cols + cc] !== word[k]) break;
          cells.push(rr * cols + cc);
        }
        if (cells.length === word.length)
          keys.add(
            cells
              .slice()
              .sort((a, b) => a - b)
              .join(","),
          );
      }
    }
  }
  return keys.size;
}

const related = (a: string, b: string) => {
  const rb = [...b].reverse().join("");
  return a.includes(b) || b.includes(a) || a.includes(rb) || rb.includes(a);
};

/** Places words so exactly `target` squares are covered. Returns placements and the grid, or null. */
export function place(
  words: string[],
  rows: number,
  cols: number,
  dirs: [number, number][],
  target: number,
  rng: Rng,
): { grid: string[]; placements: Placement[] } | null {
  const grid = new Array<string>(rows * cols).fill("");
  const placements: Placement[] = [];
  let covered = 0;
  const order = [...words.slice(0, 3), ...rng.shuffle(words.slice(3))];
  for (const w of order) {
    if (covered === target) break;
    if (placements.some((p) => related(p.word, w))) continue;
    const options: { cells: number[]; added: number }[] = [];
    for (let t = 0; t < 120; t++) {
      const [dr, dc] = dirs[rng.int(0, dirs.length - 1)];
      const r = rng.int(0, rows - 1),
        c = rng.int(0, cols - 1);
      const er = r + dr * (w.length - 1),
        ec = c + dc * (w.length - 1);
      if (er < 0 || ec < 0 || er >= rows || ec >= cols) continue;
      const cells = Array.from({ length: w.length }, (_, k) => (r + dr * k) * cols + c + dc * k);
      if (!cells.every((i, k) => grid[i] === "" || grid[i] === w[k])) continue;
      const added = cells.filter((i) => grid[i] === "").length;
      if (added === 0 || covered + added > target) continue;
      options.push({ cells, added });
    }
    if (!options.length) continue;
    // land exactly on the target when possible, otherwise take the first fit
    const exact = options.find((o) => covered + o.added === target);
    const pick = exact ?? options[0];
    pick.cells.forEach((i, k) => (grid[i] = w[k]));
    covered += pick.added;
    placements.push({ word: w, cells: pick.cells });
  }
  return covered === target && placements.length >= 4 ? { grid, placements } : null;
}

export function grade(rows: number, dirs: number, words: number, d: Difficulty): number {
  const day = { easy: 0, medium: 10, hard: 20, expert: 30, mega: 40 }[d];
  return Math.max(0, Math.min(100, day + (rows - 6) * 4 + dirs * 3 + words));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<BuriedPuzzle, BuriedSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const e = CONTENT[i];
  const rows = ROWS_FOR[difficulty],
    cols = COLS,
    dirs = DIRS_FOR[difficulty];
  const phrase = e.phrase.replace(/ /g, "");
  const rng = createRng(`buried:${i}:${difficulty}`);
  for (let attempt = 0; attempt < 3000; attempt++) {
    const res = place(e.words, rows, cols, dirs, rows * cols - phrase.length, rng);
    if (!res) continue;
    let k = 0;
    const letters = res.grid.map((ch) => ch || phrase[k++]);
    if (!res.placements.every((p) => occurrences(letters, rows, cols, p.word) === 1)) continue;
    const puzzle: BuriedPuzzle = {
      ref: { game: "buried", i, d: difficulty },
      rows,
      cols,
      letters,
      theme: e.theme,
      words: res.placements.map((p) => p.word).sort(),
      phraseShape: e.phrase.split(" ").map((w) => w.length),
    };
    return {
      puzzle,
      solution: { placements: res.placements, phrase: e.phrase },
      grade: grade(rows, dirs.length, res.placements.length, difficulty),
    };
  }
  throw new Error(`buried: could not lay out entry ${i} on ${difficulty}`);
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<BuriedPuzzle, BuriedSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Pure check of a dragged line against the hidden placements. A line that is not a hidden word but reads
 * as a real word (either way, 4+ letters, not one of the listed words) comes back as a bonus.
 */
export function checkGuess(p: BuriedPuzzle, s: BuriedSolution, guess: BuriedGuess): BuriedCheck {
  if (!isStraight(guess, p.rows, p.cols)) return { ok: false };
  const hit = s.placements.find((pl) => sameSet(pl.cells, guess));
  if (hit) return { ok: true, word: hit.word };
  if (guess.length < BONUS_MIN) return { ok: false };
  const fwd = guess.map((i) => p.letters[i]).join("");
  const back = [...fwd].reverse().join("");
  const word = [fwd, back].find((w) => isWord(w) && !p.words.includes(w));
  return word ? { ok: false, bonus: true, word } : { ok: false };
}

/**
 * Distinct bonus words in a state, each re-checked here against the dictionary (never trusted from the
 * client). Returns null when any bonus entry is malformed, not a real word, or a repeat.
 */
export function bonusWords(p: BuriedPuzzle, s: BuriedSolution, state: BuriedState): string[] | null {
  const list = state?.bonus;
  if (list === undefined) return [];
  if (!Array.isArray(list)) return null;
  const out: string[] = [];
  for (const path of list) {
    const r = checkGuess(p, s, path);
    if (!r.bonus || out.includes(r.word)) return null;
    out.push(r.word);
  }
  return out;
}

function matched(p: BuriedPuzzle, s: BuriedSolution, state: BuriedState): Set<string> | null {
  if (!state || !Array.isArray(state.found)) return null;
  const got = new Set<string>();
  for (const path of state.found) {
    const r = checkGuess(p, s, path);
    if (!r.ok || got.has(r.word)) return null;
    got.add(r.word);
  }
  return got;
}

export function progress(p: BuriedPuzzle, s: BuriedSolution, state: BuriedState): number {
  return (matched(p, s, state)?.size ?? 0) / s.placements.length;
}

export function verify(p: BuriedPuzzle, s: BuriedSolution, state: BuriedState): VerifyResult {
  const got = matched(p, s, state);
  if (!got) return { ok: false, progress: 0, reason: "malformed or wrong line" };
  if (!bonusWords(p, s, state)) return { ok: false, progress: 0, reason: "invalid bonus word" };
  return got.size === s.placements.length
    ? { ok: true, progress: 1 }
    : { ok: false, progress: got.size / s.placements.length, reason: "incomplete" };
}

/** Where an unfound word starts (shortest first). */
export function hint(p: BuriedPuzzle, s: BuriedSolution, state: BuriedState): Hint | null {
  const got = matched(p, s, state) ?? new Set<string>();
  const left = s.placements.filter((pl) => !got.has(pl.word)).sort((a, b) => a.word.length - b.word.length);
  if (!left.length) return null;
  const pl = left[0];
  const r = Math.floor(pl.cells[0] / p.cols) + 1,
    c = (pl.cells[0] % p.cols) + 1;
  return { target: pl.cells[0], text: BURIED_COPY.hintStart(pl.word, r, c) };
}

const logic: GuessLogic<BuriedPuzzle, BuriedSolution, BuriedState, BuriedGuess, BuriedCheck> = {
  id: "buried",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
