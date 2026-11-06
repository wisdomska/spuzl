/**
 * Ludo, 2 to 4 players, 4 pieces each, on the classic 15 × 15 cross.
 *
 * Colours (never colour alone, each carries a shape): 0 cyan circle, 1 orange square, 2 yellow
 * diamond, 3 lime drop. Two players take opposite corners (colours 0 and 2).
 * A piece's progress is -1 in base, 0..50 on the shared track (relative to its own start square),
 * 51..55 up its home column and 56 home.
 * - Roll a 6 to bring a piece out onto its start square.
 * - Exact rolls only to reach home.
 * - Landing on a rival on a plain track square sends it back to base. Start squares and star squares are
 *   safe: pieces share them.
 * - Blocks: two or more pieces of one colour on any track square (star and start squares too) form a block. Rivals
 *   can't land on it or pass it; the owner's own pieces can. A piece coming out onto its own start square still can.
 * - A 6, a capture or reaching home earns another roll, every time: sixes in a row never cost the turn.
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
  /**
   * an option move (house rules): "back" a back-kick, "home" a home-kick, "side" a side-kick (move, then jump
   * across the lane onto the rival you kick), "backside" a back-kick through the side line (back by the roll, then
   * across); plain moves forward have none
   */
  alt?: LudoAlt;
}

/**
 * House rules a Ludo match can switch on before it starts (all off by default, and in Quick Match):
 * - backKick: a piece may move back by the roll when that lands on a lone rival, and sends it home;
 * - sideKick: landing straight across the lane from a lone rival (same line, other side of the arm) may kick it home,
 *   and your piece takes its square; with backKick too, the kick can be made from the square a back move reaches;
 * - homeKick: a piece may run into a rival's home column on an exact count to take a piece there, then waits at
 *   the column's mouth (it can't stay in another colour's column).
 * Safe squares and blocks protect as always.
 */
export interface LudoOpts {
  backKick?: boolean;
  sideKick?: boolean;
  homeKick?: boolean;
}

export type LudoAlt = "back" | "home" | "side" | "backside";

export function target(p: number, roll: number): number {
  if (p < 0) return roll === 6 ? 0 : -2;
  const t = p + roll;
  return t > HOME ? -2 : t;
}

/** Track squares (absolute) held by a rival block: two or more pieces of one other seat, on any square. */
export function rivalBlocks(t: Table, seat: number): Set<number> {
  const out = new Set<number>();
  t.pieces.forEach((ps, s) => {
    if (s === seat) return;
    const seen = new Set<number>();
    for (const q of ps) {
      const a = absOf(t.colours[s], q);
      if (a < 0) continue;
      if (seen.has(a)) out.add(a);
      seen.add(a);
    }
  });
  return out;
}

/** Lone rival pieces (no block, not on a safe square) on a track square, as [seat, piece]. */
function loneRivals(t: Table, seat: number, abs: number, blocks: Set<number>): [number, number][] {
  if (abs < 0 || SAFE.has(abs) || blocks.has(abs)) return [];
  const out: [number, number][] = [];
  t.pieces.forEach((ps, s) => {
    if (s === seat) return;
    ps.forEach((q, j) => {
      if (absOf(t.colours[s], q) === abs) out.push([s, j]);
    });
  });
  return out;
}

export function legalSteps(t: Table, seat: number, roll: number, opts: LudoOpts = {}): Step[] {
  const out: Step[] = [];
  const colour = t.colours[seat];
  const blocks = rivalBlocks(t, seat);
  // no rival block strictly between two of this piece's track positions
  const clear = (a: number, b: number) => {
    for (let q = Math.min(a, b) + 1; q < Math.max(a, b); q++) if (q <= LAST_TRACK && blocks.has(absOf(colour, q))) return false;
    return true;
  };
  // side-kick from a square this piece reaches: jump across the lane onto a lone rival there, taking its square
  const across = (L: number): { to: number; captures: [number, number][] } | null => {
    const a = absOf(colour, L);
    if (a < 0 || !PARTNER.has(a)) return null;
    const P = PARTNER.get(a)!;
    const caps = loneRivals(t, seat, P, blocks);
    const to = (P - startOf(colour) + TRACK_LEN) % TRACK_LEN;
    return caps.length && to <= LAST_TRACK ? { to, captures: caps } : null;
  };
  t.pieces[seat].forEach((p, i) => {
    if (p < 0 || p > LAST_TRACK) return;
    const back = p - roll;
    if (opts.backKick && back >= 0 && clear(p, back) && !blocks.has(absOf(colour, back))) {
      // back-kick: back by the roll onto a lone rival
      const caps = loneRivals(t, seat, absOf(colour, back), blocks);
      if (caps.length) out.push({ piece: i, from: p, to: back, captures: caps, alt: "back" });
      // back-kick through the side line: back by the roll, then across onto a lone rival
      const x = opts.sideKick ? across(back) : null;
      if (x) out.push({ piece: i, from: p, to: x.to, captures: x.captures, alt: "backside" });
    }
    // home-kick: up a rival's home column on an exact count, onto one of its pieces
    if (opts.homeKick)
      t.pieces.forEach((ps, s) => {
        if (s === seat) return;
        const mouth = absOf(t.colours[s], LAST_TRACK);
        const k = (mouth - absOf(colour, p) + TRACK_LEN) % TRACK_LEN;
        if (p + k > LAST_TRACK || !clear(p, p + k + 1) || blocks.has(mouth)) return;
        ps.forEach((q, j) => {
          if (q > LAST_TRACK && q < HOME && k + (q - LAST_TRACK) === roll)
            out.push({ piece: i, from: p, to: p + k, captures: [[s, j]], alt: "home" });
        });
      });
  });
  t.pieces[seat].forEach((p, i) => {
    if (p === HOME) return;
    const to = target(p, roll);
    if (to === -2) return;
    // a rival block stops the piece: it can't pass it or land on it (coming out lands on the safe start square)
    if (p >= 0 && blocks.size) for (let q = p + 1; q <= Math.min(to, LAST_TRACK); q++) if (blocks.has(absOf(colour, q))) return;
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
    // side-kick: instead of stopping there, jump across the lane onto a lone rival and take its square
    const x = opts.sideKick && to <= LAST_TRACK ? across(to) : null;
    if (x) out.push({ piece: i, from: p, to: x.to, captures: x.captures, alt: "side" });
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

/**
 * The square straight across the lane from each track square (absolute index to absolute index): the two outer
 * lanes of an arm face each other across its home column, row for row. The arm tips have no partner.
 */
export const PARTNER: Map<number, number> = (() => {
  const at = new Map(TRACK.map(([r, c], k) => [`${r},${c}`, k]));
  const m = new Map<number, number>();
  TRACK.forEach(([r, c], k) => {
    const across = (r === 6 || r === 8) && (c < 6 || c > 8) ? [14 - r, c] : (c === 6 || c === 8) && (r < 6 || r > 8) ? [r, 14 - c] : null;
    const j = across ? at.get(`${across[0]},${across[1]}`) : undefined;
    if (j !== undefined) m.set(k, j);
  });
  return m;
})();

/** Each colour's home column, from the track inwards. */
export const HOME_COL_CELLS: [number, number][][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c] as [number, number]),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as [number, number]),
  [13, 12, 11, 10, 9].map((c) => [7, c] as [number, number]),
  [13, 12, 11, 10, 9].map((r) => [r, 7] as [number, number]),
];
const BASE_ORIGIN: [number, number][] = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
];
const SLOTS: [number, number][] = [
  [1, 1],
  [1, 4],
  [4, 1],
  [4, 4],
];

/** Where a piece sits on the 15 × 15 grid. */
export function cellOf(colour: number, piece: number, p: number): [number, number] {
  if (p < 0) {
    const [r0, c0] = BASE_ORIGIN[colour];
    return [r0 + SLOTS[piece][0], c0 + SLOTS[piece][1]];
  }
  if (p <= LAST_TRACK) return TRACK[absOf(colour, p)];
  if (p < HOME) return HOME_COL_CELLS[colour][p - 51];
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
  for (let k = 0; k < 4; k++) if (HOME_COL_CELLS[k].some(([a, b]) => a === r && b === c)) return k;
  return -1;
}

export function trackIndexOfCell(r: number, c: number): number {
  return TRACK.findIndex(([a, b]) => a === r && b === c);
}
