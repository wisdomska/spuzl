/**
 * Ludo, 2 to 4 players, 4 pieces each, on the classic 15 × 15 cross.
 *
 * Colours (never colour alone, each carries a shape): 0 cyan circle, 1 orange square, 2 yellow
 * diamond, 3 lime drop. Two players take opposite corners (colours 0 and 2).
 * A piece's progress is -1 in base, 0..50 on the shared track (relative to its own start square),
 * 51..55 up its home column and 56 home.
 * - Roll a 6 to bring a piece out onto its start square.
 * - Exact rolls only to reach home.
 * - Landing on a rival on a plain track square sends every rival piece there back to base. Start
 *   squares and star squares are safe: pieces share them.
 * - A 6, a capture or reaching home earns another roll; a third 6 in a row ends the turn.
 * - First to bring all four pieces home wins.
 */
export const TRACK_LEN = 52;
export const HOME = 56;
export const LAST_TRACK = 50;
export const COLOURS = 4;

/** Absolute track squares that are safe: the four starts and the four stars. */
export const SAFE = new Set([0, 13, 26, 39, 8, 21, 34, 47]);
export const startOf = (colour: number) => colour * 13;

/** Absolute track square of a piece, or -1 when it is in base or in its home column. */
export function absOf(colour: number, p: number): number {
  return p < 0 || p > LAST_TRACK ? -1 : (startOf(colour) + p) % TRACK_LEN;
}

/** Colours in play for a seat count. */
export function coloursFor(seats: number): number[] {
  if (seats === 2) return [0, 2];
  if (seats === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export interface Table {
  /** colour of each seat */
  colours: number[];
  /** progress of each seat's 4 pieces */
  pieces: number[][];
}

export interface Step {
  piece: number;
  from: number;
  to: number;
  /** [seat, piece] of rivals sent back to base */
  captures: [number, number][];
}

export function target(p: number, roll: number): number {
  if (p < 0) return roll === 6 ? 0 : -2;
  const t = p + roll;
  return t > HOME ? -2 : t;
}

export function legalSteps(t: Table, seat: number, roll: number): Step[] {
  const out: Step[] = [];
  const colour = t.colours[seat];
  t.pieces[seat].forEach((p, i) => {
    if (p === HOME) return;
    const to = target(p, roll);
    if (to === -2) return;
    const abs = absOf(colour, to);
    const captures: [number, number][] = [];
    if (abs >= 0 && !SAFE.has(abs))
      t.pieces.forEach((ps, s) => {
        if (s === seat) return;
        ps.forEach((q, j) => {
          if (absOf(t.colours[s], q) === abs) captures.push([s, j]);
        });
      });
    out.push({ piece: i, from: p, to, captures });
  });
  return out;
}

export function applyStep(t: Table, seat: number, step: Step): Table {
  const pieces = t.pieces.map((ps) => ps.slice());
  pieces[seat][step.piece] = step.to;
  for (const [s, j] of step.captures) pieces[s][j] = -1;
  return { colours: t.colours, pieces };
}

/** Is the piece on `abs` within 1..6 squares ahead of a rival piece (and not on a safe square)? */
export function threatened(t: Table, seat: number, abs: number): boolean {
  if (abs < 0 || SAFE.has(abs)) return false;
  return t.pieces.some((ps, s) => {
    if (s === seat) return false;
    return ps.some((q) => {
      const a = absOf(t.colours[s], q);
      if (a < 0) return false;
      const d = (abs - a + TRACK_LEN) % TRACK_LEN;
      // a rival cannot run past its own home entry
      return d >= 1 && d <= 6 && q + d <= LAST_TRACK;
    });
  });
}

/* ---------------- Board geometry (15 × 15) ---------------- */

/** Track squares 0..51 as [row, col], starting at colour 0's start square and running clockwise. */
export const TRACK: [number, number][] = (() => {
  const t: [number, number][] = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  t.push([6, 0]);
  return t;
})();

const HOME_COL: [number, number][][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c] as [number, number]),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as [number, number]),
  [13, 12, 11, 10, 9].map((c) => [7, c] as [number, number]),
  [13, 12, 11, 10, 9].map((r) => [r, 7] as [number, number]),
];
const BASE_ORIGIN: [number, number][] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const SLOTS: [number, number][] = [[1, 1], [1, 4], [4, 1], [4, 4]];

/** Where a piece sits on the 15 × 15 grid. */
export function cellOf(colour: number, piece: number, p: number): [number, number] {
  if (p < 0) {
    const [r0, c0] = BASE_ORIGIN[colour];
    return [r0 + SLOTS[piece][0], c0 + SLOTS[piece][1]];
  }
  if (p <= LAST_TRACK) return TRACK[absOf(colour, p)];
  if (p < HOME) return HOME_COL[colour][p - 51];
  return [7, 7];
}

/** Base quadrant colour of a grid cell, or -1. */
export function baseOfCell(r: number, c: number): number {
  if (r < 6 && c < 6) return 0;
  if (r < 6 && c > 8) return 1;
  if (r > 8 && c > 8) return 2;
  if (r > 8 && c < 6) return 3;
  return -1;
}

/** Home column colour of a grid cell, or -1. */
export function homeColOfCell(r: number, c: number): number {
  for (let k = 0; k < 4; k++) if (HOME_COL[k].some(([a, b]) => a === r && b === c)) return k;
  return -1;
}

export function trackIndexOfCell(r: number, c: number): number {
  return TRACK.findIndex(([a, b]) => a === r && b === c);
}
