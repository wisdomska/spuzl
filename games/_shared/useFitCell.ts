"use client";

import type { RefObject } from "react";
import { SLOT_PAD, useBoardBox, useCellSize, useFitHeight } from "@/components/game/useBoardSize";

/**
 * Cell size for Line Lane boards, plus a bleed. Drag-to-draw boards cannot pan (a horizontal drag
 * draws), so when 44 px cells make the board wider than the board slot, the board may grow into the
 * slot's side padding (up to SLOT_PAD, 12 px, each side).
 * Apply `bleed` as a negative inline margin on the board wrapper.
 */
export function useFitCell(cols: number, gap: number, pad: number): { cs: number; bleed: number } {
  const cs = useCellSize(cols, gap, pad * 2 + 4);
  const board = cols * cs + (cols - 1) * gap + pad * 2;
  // The board slot's width inside its padding (the board column on a wide screen).
  const avail = useBoardBox().w;
  const bleed = board > avail ? Math.min(SLOT_PAD, Math.ceil((board - avail) / 2)) : 0;
  return { cs, bleed };
}

/**
 * useFitCell that also fits the height: on a short phone the cells step down (to `min` px at most) until the
 * whole game shell, down to its tool bar, sits above the fold (useFitHeight, measured from `target`, with its
 * guard). The bleed follows the size actually used.
 */
export function useFitCellHeight(
  cols: number,
  gap: number,
  pad: number,
  rows: number,
  target: RefObject<HTMLElement | null>,
  min = 32,
): { cs: number; bleed: number } {
  const ideal = useCellSize(cols, gap, pad * 2 + 4, 64, rows);
  const cs = useFitHeight(ideal, Math.min(min, ideal), rows, target, "shell");
  const board = cols * cs + (cols - 1) * gap + pad * 2;
  const avail = useBoardBox().w;
  const bleed = board > avail ? Math.min(SLOT_PAD, Math.ceil((board - avail) / 2)) : 0;
  return { cs, bleed };
}
