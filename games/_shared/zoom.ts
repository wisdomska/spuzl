/**
 * Tap-to-zoom for grid boards (Light Up R4-22, Tripwire R7). A board whose cells come out under ZOOM_AT px opens
 * zoomed on a tap: the board keeps its overview size on screen, and the grid inside it is drawn at `cell` px a cell
 * and moved (`Pan`, px of the zoomed grid hidden off the top left) so every cell tapped is big enough to hit. Grids
 * may be square (`n` across and down, a square `view`) or not (`rows` down, `viewH` px high). Pure maths, shared by
 * the boards and their tests.
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
  /** cells across (and down, unless `rows` is set) */
  n: number;
  /** cells down, when not `n` */
  rows?: number;
  /** zoomed cell size, px */
  cell: number;
  gap: number;
  pad: number;
  /** the view (the board's overview size), px wide (and high, unless `viewH` is set) */
  view: number;
  /** the view's height, px, when not `view` */
  viewH?: number;
}

const side = (count: number, g: ZoomGeo) => count * g.cell + (count - 1) * g.gap + g.pad * 2;
const rowsOf = (g: ZoomGeo) => g.rows ?? g.n;
const viewHOf = (g: ZoomGeo) => g.viewH ?? g.view;

/** The zoomed grid's full width, px. */
export const zoomedSide = (g: ZoomGeo) => side(g.n, g);
/** The zoomed grid's full height, px. */
export const zoomedHeight = (g: ZoomGeo) => side(rowsOf(g), g);

/** Keeps a pan inside the zoomed grid (no empty edge shows). */
export function clampPan(p: Pan, g: ZoomGeo): Pan {
  const maxX = Math.max(0, zoomedSide(g) - g.view);
  const maxY = Math.max(0, zoomedHeight(g) - viewHOf(g));
  return { x: Math.round(Math.min(maxX, Math.max(0, p.x))), y: Math.round(Math.min(maxY, Math.max(0, p.y))) };
}

/** Where cell (r, c) starts in the zoomed grid, px. */
const cellAt = (i: number, g: ZoomGeo) => g.pad + i * (g.cell + g.gap);

/** The pan that puts cell (r, c) in the middle of the view (clamped at the edges). */
export function centreOn(r: number, c: number, g: ZoomGeo): Pan {
  return clampPan({ x: cellAt(c, g) - (g.view - g.cell) / 2, y: cellAt(r, g) - (viewHOf(g) - g.cell) / 2 }, g);
}

/** The smallest move from `p` that shows all of cell (r, c) (keyboard focus, a hint), with a gap's margin. */
export function panToShow(p: Pan, r: number, c: number, g: ZoomGeo): Pan {
  const fit = (cur: number, i: number, view: number) => {
    const lo = cellAt(i, g) - g.pad;
    const hi = cellAt(i, g) + g.cell + g.pad;
    if (lo < cur) return lo;
    if (hi > cur + view) return hi - view;
    return cur;
  };
  return clampPan({ x: fit(p.x, c, g.view), y: fit(p.y, r, viewHOf(g)) }, g);
}

/** Is cell (r, c) wholly inside the view at pan `p`? */
export function shows(p: Pan, r: number, c: number, g: ZoomGeo): boolean {
  const x = cellAt(c, g) - p.x,
    y = cellAt(r, g) - p.y;
  return x >= 0 && y >= 0 && x + g.cell <= g.view && y + g.cell <= viewHOf(g);
}
