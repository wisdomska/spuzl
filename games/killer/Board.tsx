"use client";

import type { BoardProps } from "@/games/types";
import { SudokuBoard } from "@/games/_shared/sudoku/SudokuBoard";
import { killer as t } from "@/lib/copy/killer";
import type { KillerPuzzle, KillerState } from "./logic";

/** Killer Sums board: the shared sudoku board with dotted cages and their totals (6 × 6 or 9 × 9). */
export default function KillerBoard(props: BoardProps<KillerPuzzle, KillerState>) {
  return <SudokuBoard {...props} title={t.title} />;
}
