/**
 * Sixer: 1 to 6 once in every row, column and 2 × 3 box. Built on the shared sudoku engine
 * (games/_shared/sudoku/logic.ts) with 6 × 6 plans: easy and medium fall to singles, hard may need
 * locked candidates or pairs, expert and mega keep only the clues uniqueness needs.
 */
import { makeSudokuLogic } from "@/games/_shared/sudoku/logic";

export type { SudokuPuzzle as SixerPuzzle, SudokuSolution as SixerSolution, SudokuState as SixerState } from "@/games/_shared/sudoku/logic";

export const SIZE = 6;
const logic = makeSudokuLogic("sixer", SIZE);
export const generate = logic.generate;
export const countSolutions = logic.countSolutions!;
export const verify = logic.verify;
export const progress = logic.progress;
export const hint = logic.hint!;
export default logic;
