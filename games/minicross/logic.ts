/**
 * Minicross: a 5 × 5 crossword. The client gets the grid shape, numbers and clues only; the letters stay
 * on the server. A full grid is checked with checkGuess (right or not, never which squares).
 */
import type { Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import type { GuessLogic } from "@/games/_shared/guess";
import { createRng, type Rng } from "@/lib/rng";
import { CONTENT } from "./content";
import {
  numberGrid,
  SIZE,
  validCells,
  type MinicrossCheck,
  type MinicrossGuess,
  type MinicrossPuzzle,
  type MinicrossSolution,
  type MinicrossState,
} from "./rules";

export const contentCount = CONTENT.length;

const DAY_WEIGHT: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 45, expert: 55, mega: 65 };
/** Easy days pre-fill this many squares. */
const GIVEN: Record<Difficulty, number> = { easy: 3, medium: 0, hard: 0, expert: 0, mega: 0 };

export function grade(grid: string[], d: Difficulty): number {
  const letters = grid.filter((x) => x !== "#");
  const rare = letters.filter((x) => "JQXZKVWY".includes(x)).length;
  return Math.max(0, Math.min(100, DAY_WEIGHT[d] + rare * 2 + (25 - letters.length)));
}

export function generateAt(index: number, difficulty: Difficulty): Generated<MinicrossPuzzle, MinicrossSolution> {
  const i = ((index % contentCount) + contentCount) % contentCount;
  const e = CONTENT[i];
  const grid = e.rows.join("").split("");
  const blocks = grid.map((x) => x === "#");
  const { across, down } = numberGrid(blocks, SIZE);
  const puzzle: MinicrossPuzzle = {
    ref: { game: "minicross", i, d: difficulty },
    size: SIZE,
    blocks,
    across: across.map((cl, k) => ({ ...cl, text: e.across[k] })),
    down: down.map((cl, k) => ({ ...cl, text: e.down[k] })),
  };
  if (GIVEN[difficulty]) {
    const rng = createRng(`minicross:${i}:${difficulty}`);
    const open = rng.shuffle(grid.map((x, k) => (x === "#" ? -1 : k)).filter((k) => k >= 0));
    puzzle.given = Object.fromEntries(open.slice(0, GIVEN[difficulty]).map((k) => [k, grid[k]]));
  }
  return { puzzle, solution: { grid }, grade: grade(grid, difficulty) };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<MinicrossPuzzle, MinicrossSolution> {
  return generateAt(rng.int(0, contentCount - 1), difficulty);
}

const full = (p: MinicrossPuzzle, cells: string[]) => cells.every((ch, i) => p.blocks[i] || ch !== "");
const solvedBy = (s: MinicrossSolution, cells: string[]) => s.grid.every((x, i) => x === "#" || cells[i] === x);

/** Pure check of a full grid: right or not. Partial or malformed grids are never right. */
export function checkGuess(p: MinicrossPuzzle, s: MinicrossSolution, guess: MinicrossGuess): MinicrossCheck {
  if (!guess || !validCells(p, guess.cells) || !full(p, guess.cells)) return { ok: false };
  return { ok: solvedBy(s, guess.cells) };
}

export function progress(p: MinicrossPuzzle, s: MinicrossSolution, state: MinicrossState): number {
  if (!state || !validCells(p, state.cells)) return 0;
  const open = s.grid.filter((x) => x !== "#").length;
  return s.grid.filter((x, i) => x !== "#" && state.cells[i] === x).length / open;
}

export function verify(p: MinicrossPuzzle, s: MinicrossSolution, state: MinicrossState): VerifyResult {
  if (!state || !validCells(p, state.cells)) return { ok: false, progress: 0, reason: "malformed state" };
  const prog = progress(p, s, state);
  return solvedBy(s, state.cells)
    ? { ok: true, progress: 1 }
    : { ok: false, progress: prog, reason: full(p, state.cells) ? "wrong letters" : "incomplete" };
}

/** Fixes the first wrong square, or fills the first empty one, in reading order. */
export function hint(p: MinicrossPuzzle, s: MinicrossSolution, state: MinicrossState): Hint | null {
  const cells = state && validCells(p, state.cells) ? state.cells : s.grid.map(() => "");
  const wrong = s.grid.findIndex((x, i) => x !== "#" && cells[i] !== "" && cells[i] !== x);
  const empty = s.grid.findIndex((x, i) => x !== "#" && cells[i] === "");
  const i = wrong >= 0 ? wrong : empty;
  if (i < 0) return null;
  const r = Math.floor(i / p.size) + 1,
    c = (i % p.size) + 1;
  return { target: { cell: i, letter: s.grid[i] }, text: `${wrong >= 0 ? "Fixed" : "Filled"} row ${r}, column ${c}: ${s.grid[i]}.` };
}

const logic: GuessLogic<MinicrossPuzzle, MinicrossSolution, MinicrossState, MinicrossGuess, MinicrossCheck> = {
  id: "minicross",
  contentCount,
  generate,
  generateAt,
  checkGuess,
  verify,
  progress,
  hint,
};
export default logic;
