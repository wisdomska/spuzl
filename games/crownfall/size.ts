import { cellSize } from "@/components/game/useBoardSize";

/** The grid's padding on each side (`p-1.5` on the grid). Both sides count against the room for cells. */
export const GRID_PAD = 6;

/** The phone cap per cell: roomier on the 4 × 4 lesson board. */
export const cellCap = (n: number) => (n <= 4 ? 72 : 64);

/** The px a Crownfall grid takes across (and down): n touching cells plus the padding on both sides. */
export const gridSpan = (n: number, cell: number) => n * cell + GRID_PAD * 2;

/** Crownfall's cell size for a viewport, before the height fit (pure, for `useCrownfallCell` and tests). */
export function crownfallCell(vw: number, vh: number, n: number): number {
  return cellSize(vw, vh, n, 0, GRID_PAD * 2, cellCap(n));
}
