"use client";

import { useCellSize, useViewportWidth } from "@/components/game/useBoardSize";

/** The GameShell board slot pads the board by 18 px on each side. */
const SLOT_PAD = 18;

/**
 * Cell size for Line Lane boards, plus a bleed. Drag-to-draw boards cannot pan (a horizontal drag
 * draws), so when 44 px cells make the board wider than the board slot, the board may grow into the
 * slot's side padding (up to 18 px each side). An 8 column board then fits a 390 px phone exactly.
 * Apply `bleed` as a negative inline margin on the board wrapper.
 */
export function useFitCell(cols: number, gap: number, pad: number): { cs: number; bleed: number } {
  const cs = useCellSize(cols, gap, pad * 2 + 4);
  const vw = useViewportWidth();
  const board = cols * cs + (cols - 1) * gap + pad * 2;
  const avail = Math.min(vw, 560) - SLOT_PAD * 2;
  const bleed = board > avail ? Math.min(SLOT_PAD, Math.ceil((board - avail) / 2)) : 0;
  return { cs, bleed };
}
