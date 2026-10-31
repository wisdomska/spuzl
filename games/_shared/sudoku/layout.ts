/**
 * Pure layout helpers for the sudoku board (Sixer, Nine): box numbering for accessible names and the
 * grid track list that gives box boundaries their own, thicker lines.
 */

/** 0-based box index of cell `i`, numbered left to right, top to bottom (same order as the engine's units). */
export function boxIndex(i: number, size: number, boxW: number, boxH: number): number {
  const r = Math.floor(i / size),
    c = i % size;
  return Math.floor(r / boxH) * (size / boxW) + Math.floor(c / boxW);
}

/** True when the gap after line `k` (0-based row or column) is a box boundary. */
export const isBoundary = (k: number, per: number, size: number) => k < size - 1 && (k + 1) % per === 0;

/**
 * CSS grid track list along one axis: `size` cell tracks with a track between each pair, `gap` px inside
 * a box and `line` px on a box boundary. Cell k sits on track 2k + 1; the gap after it is track 2k + 2.
 */
export function trackList(size: number, per: number, cell: number, gap: number, line: number): string {
  const out: string[] = [];
  for (let k = 0; k < size; k++) {
    out.push(`${cell}px`);
    if (k < size - 1) out.push(`${isBoundary(k, per, size) ? line : gap}px`);
  }
  return out.join(" ");
}

/** 1-based CSS grid track numbers of the box-boundary gaps along one axis. */
export function boundaryTracks(size: number, per: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < size - 1; k++) if (isBoundary(k, per, size)) out.push(2 * k + 2);
  return out;
}

/** Total px of the gaps along one axis (cells and outer padding not included). */
export function gapTotal(size: number, per: number, gap: number, line: number): number {
  const lines = boundaryTracks(size, per).length;
  return lines * line + (size - 1 - lines) * gap;
}

/** How many of each digit are on the board: counts[d] for d in 1..size (index 0 counts empties). */
export function digitCounts(values: number[], size: number): number[] {
  const counts = new Array(size + 1).fill(0);
  for (const v of values) if (v >= 0 && v <= size) counts[v]++;
  return counts;
}
