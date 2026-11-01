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

/** px offset of each cell's leading edge along one axis, from the board's outer edge (`pad` included). */
export function cellOffsets(size: number, per: number, cell: number, gap: number, line: number, pad: number): number[] {
  const out: number[] = [];
  let x = pad;
  for (let k = 0; k < size; k++) {
    out.push(x);
    x += cell + (isBoundary(k, per, size) ? line : gap);
  }
  return out;
}

/** A straight piece of a cage outline, in board px. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Dotted cage outlines (Killer Sums): every cell side that borders another cage (or the board edge) gets a
 * line `inset` px inside the cell. Ends meet the next piece across the gap, turn at convex corners and reach
 * across to the neighbouring cell at concave ones, so each cage reads as one closed outline. The first cell
 * of a cage (reading order) leaves room `label` px wide and tall for the total in its top-left corner.
 */
export function cageSegments(
  cageOf: number[],
  size: number,
  xs: number[],
  ys: number[],
  cell: number,
  inset: number,
  label: { w: number; h: number },
): Segment[] {
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= size || c >= size ? -1 : cageOf[r * size + c]);
  // gap after cell k along an axis (0 past the edge)
  const gapX = (c: number) => (c + 1 < size ? xs[c + 1] - xs[c] - cell : 0);
  const gapY = (r: number) => (r + 1 < size ? ys[r + 1] - ys[r] - cell : 0);
  const firsts = new Set<number>();
  const seen = new Set<number>();
  cageOf.forEach((k, i) => {
    if (!seen.has(k)) {
      seen.add(k);
      firsts.add(i);
    }
  });
  const out: Segment[] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const k = at(r, c);
      const L = xs[c],
        R = xs[c] + cell,
        T = ys[r],
        B = ys[r] + cell;
      const same = (dr: number, dc: number) => at(r + dr, c + dc) === k;
      const first = firsts.has(r * size + c);
      // Horizontal sides: top (dr = -1) and bottom (dr = 1).
      for (const dr of [-1, 1]) {
        if (same(dr, 0)) continue;
        const y = dr < 0 ? T + inset : B - inset;
        const x1 = !same(0, -1) ? L + inset : !same(dr, -1) ? L - gapX(c - 1) / 2 : L - gapX(c - 1) - inset;
        const x2 = !same(0, 1) ? R - inset : !same(dr, 1) ? R + gapX(c) / 2 : R + gapX(c) + inset;
        out.push({ x1: dr < 0 && first ? Math.max(x1, L + label.w) : x1, y1: y, x2, y2: y });
      }
      // Vertical sides: left (dc = -1) and right (dc = 1).
      for (const dc of [-1, 1]) {
        if (same(0, dc)) continue;
        const x = dc < 0 ? L + inset : R - inset;
        const y1 = !same(-1, 0) ? T + inset : !same(-1, dc) ? T - gapY(r - 1) / 2 : T - gapY(r - 1) - inset;
        const y2 = !same(1, 0) ? B - inset : !same(1, dc) ? B + gapY(r) / 2 : B + gapY(r) + inset;
        out.push({ x1: x, y1: dc < 0 && first ? Math.max(y1, T + label.h) : y1, x2: x, y2 });
      }
    }
  return out;
}
