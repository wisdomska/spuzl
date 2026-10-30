"use client";

import type { BoardProps } from "@/games/types";
import { SudokuBoard } from "@/games/_shared/sudoku/SudokuBoard";
import type { SixerPuzzle, SixerState } from "./logic";

/** Sixer board (Game Boards: Sixer): 6 × 6 with shaded 2 × 3 boxes, number pad and notes mode. */
export default function SixerBoard(props: BoardProps<SixerPuzzle, SixerState>) {
  return <SudokuBoard {...props} title="Sixer" />;
}
