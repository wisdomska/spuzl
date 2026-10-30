/**
 * Nine: classic sudoku, 1 to 9 once in every row, column and 3 × 3 box. Built on the shared sudoku engine
 * (games/_shared/sudoku/logic.ts) with 9 × 9 plans: easy and medium fall to singles, hard needs
 * locked candidates or pairs, expert goes beyond them. Four difficulties: mega (Sunday) uses the expert plan.
 */
import { makeSudokuLogic } from "@/games/_shared/sudoku/logic";

export type { SudokuPuzzle as NinePuzzle, SudokuSolution as NineSolution, SudokuState as NineState } from "@/games/_shared/sudoku/logic";

export const SIZE = 9;
const logic = makeSudokuLogic("nine", SIZE);
export const generate = logic.generate;
export const countSolutions = logic.countSolutions!;
export const verify = logic.verify;
export const progress = logic.progress;
export const hint = logic.hint!;
export default logic;
