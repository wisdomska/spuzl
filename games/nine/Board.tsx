"use client";

import type { BoardProps } from "@/games/types";
import { SudokuBoard } from "@/games/_shared/sudoku/SudokuBoard";
import type { NinePuzzle, NineState } from "./logic";

/** Nine board: classic 9 × 9 on the Sixer layout (shaded 3 × 3 boxes, number pad, notes mode). */
export default function NineBoard(props: BoardProps<NinePuzzle, NineState>) {
  return <SudokuBoard {...props} title="Nine" />;
}
