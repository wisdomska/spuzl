/**
 * Light Up tap-to-zoom (R4-22). A board whose cells come out under ZOOM_AT px (10 × 10 on a phone, 7 × 7 on the
 * narrowest) opens zoomed on a tap: the board keeps its overview size on screen, and the grid inside it is drawn at
 * ZOOM_CELL px a cell and moved (`Pan`, px of the zoomed grid hidden off the top left) so every cell tapped is at
 * least 44 px. Pure maths, shared by the board and its tests.
 */

/** Cells smaller than this (px) get tap-to-zoom. */
export const ZOOM_AT = 44;
/** Cell size (px) in the zoomed view. */
export const ZOOM_CELL = 48;

export interface Pan {
  x: number;
  y: number;
}

export interface ZoomGeo {
  /** cells across (and down) */
  n: number;
  /** zoomed cell size, px */
  cell: number;
  gap: number;
  pad: number;
  /** the view (the board's overview size), px square */
  view: number;
}

/** The zoomed grid's full side, px. */
export const zoomedSide = (g: ZoomGeo) => g.n * g.cell + (g.n - 1) * g.gap + g.pad * 2;

/** Keeps a pan inside the zoomed grid (no empty edge shows). */
export function clampPan(p: Pan, g: ZoomGeo): Pan {
  const max = Math.max(0, zoomedSide(g) - g.view);
  return { x: Math.round(Math.min(max, Math.max(0, p.x))), y: Math.round(Math.min(max, Math.max(0, p.y))) };
}

/** Where cell (r, c) starts in the zoomed grid, px. */
const cellAt = (i: number, g: ZoomGeo) => g.pad + i * (g.cell + g.gap);

/** The pan that puts cell (r, c) in the middle of the view (clamped at the edges). */
export function centreOn(r: number, c: number, g: ZoomGeo): Pan {
  const half = (g.view - g.cell) / 2;
  return clampPan({ x: cellAt(c, g) - half, y: cellAt(r, g) - half }, g);
}

/** The smallest move from `p` that shows all of cell (r, c) (keyboard focus, a hint), with a gap's margin. */
export function panToShow(p: Pan, r: number, c: number, g: ZoomGeo): Pan {
  const fit = (cur: number, i: number) => {
    const lo = cellAt(i, g) - g.pad;
    const hi = cellAt(i, g) + g.cell + g.pad;
    if (lo < cur) return lo;
    if (hi > cur + g.view) return hi - g.view;
    return cur;
  };
  return clampPan({ x: fit(p.x, c), y: fit(p.y, r) }, g);
}

/** Is cell (r, c) wholly inside the view at pan `p`? */
export function shows(p: Pan, r: number, c: number, g: ZoomGeo): boolean {
  const x = cellAt(c, g) - p.x,
    y = cellAt(r, g) - p.y;
  return x >= 0 && y >= 0 && x + g.cell <= g.view && y + g.cell <= g.view;
}
