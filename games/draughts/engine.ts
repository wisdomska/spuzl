/**
 * English draughts (checkers), 8 × 8. Chosen over international 10 × 10 rules because it matches the
 * designed 8 × 8 board and is the variant most players in Ghana and West Africa learn first.
 *
 * - Pieces sit on the dark squares ((row + col) odd). Squares are 0..63, row 0 at the top.
 * - Seat 0 starts at the bottom and moves up; seat 0 moves first. (English rules call the first
 *   player "black"; SPUZL paints seat 0 in the design's light pieces and seat 1 dark.)
 * - Men move and capture diagonally forward only. Kings move and capture one square in any
 *   diagonal direction (no flying kings).
 * - Captures are compulsory, but any capturing sequence may be chosen (no majority rule). Once a
 *   sequence starts it must be completed while jumps remain.
 * - A man that reaches the far row is crowned and the move ends there, even mid-sequence.
 * - A player with no legal move loses. 40 moves each without a capture or a crowning is a draw.
 */

export const EMPTY = 0;
export const MAN0 = 1, KING0 = 2, MAN1 = 3, KING1 = 4;
export type Seat = 0 | 1;
/** 64 squares, values EMPTY / MAN0 / KING0 / MAN1 / KING1 */
export type Board = number[];

export interface DMove {
  /** squares visited: start, then each landing */
  path: number[];
  /** captured squares, in order */
  caps: number[];
  /** the moving man is crowned at the end */
  crowns: boolean;
}

export const seatOf = (p: number): Seat => (p >= MAN1 ? 1 : 0);
export const isKing = (p: number) => p === KING0 || p === KING1;
export const isDark = (sq: number) => ((sq >> 3) + (sq & 7)) % 2 === 1;
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const DIAG: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function dirsFor(p: number): [number, number][] {
  if (isKing(p)) return DIAG;
  return seatOf(p) === 0 ? DIAG.slice(0, 2) : DIAG.slice(2);
}
const crownRow = (s: Seat) => (s === 0 ? 0 : 7);

export function initialBoard(): Board {
  const b: Board = new Array(64).fill(EMPTY);
  for (let sq = 0; sq < 64; sq++) {
    if (!isDark(sq)) continue;
    const r = sq >> 3;
    if (r <= 2) b[sq] = MAN1;
    else if (r >= 5) b[sq] = MAN0;
  }
  return b;
}

/** Every complete capture sequence for the piece on `from`. */
export function capturesFrom(b: Board, from: number): DMove[] {
  const p = b[from];
  if (!p) return [];
  const me = seatOf(p);
  const out: DMove[] = [];
  const work = b.slice();
  work[from] = EMPTY;
  const rec = (sq: number, path: number[], caps: number[]) => {
    const r = sq >> 3, c = sq & 7;
    let extended = false;
    for (const [dr, dc] of dirsFor(p)) {
      if (!on(r + 2 * dr, c + 2 * dc)) continue;
      const mid = (r + dr) * 8 + c + dc, land = (r + 2 * dr) * 8 + c + 2 * dc;
      const m = work[mid];
      if (!m || seatOf(m) === me || caps.includes(mid) || work[land] !== EMPTY) continue;
      extended = true;
      const np = [...path, land], nc = [...caps, mid];
      if (!isKing(p) && land >> 3 === crownRow(me)) out.push({ path: np, caps: nc, crowns: true });
      else rec(land, np, nc);
    }
    if (!extended && caps.length) out.push({ path, caps, crowns: false });
  };
  rec(from, [from], []);
  return out;
}

export function simpleFrom(b: Board, from: number): DMove[] {
  const p = b[from];
  if (!p) return [];
  const r = from >> 3, c = from & 7;
  const out: DMove[] = [];
  for (const [dr, dc] of dirsFor(p)) {
    if (!on(r + dr, c + dc)) continue;
    const to = (r + dr) * 8 + c + dc;
    if (b[to] === EMPTY) out.push({ path: [from, to], caps: [], crowns: !isKing(p) && to >> 3 === crownRow(seatOf(p)) });
  }
  return out;
}

/** Legal moves for `seat`: all capture sequences if any exist (compulsory), else simple moves. */
export function legalMoves(b: Board, seat: Seat): DMove[] {
  const caps: DMove[] = [];
  for (let sq = 0; sq < 64; sq++) if (b[sq] && seatOf(b[sq]) === seat) caps.push(...capturesFrom(b, sq));
  if (caps.length) return caps;
  const simple: DMove[] = [];
  for (let sq = 0; sq < 64; sq++) if (b[sq] && seatOf(b[sq]) === seat) simple.push(...simpleFrom(b, sq));
  return simple;
}

export function applyMove(b: Board, m: DMove): Board {
  const n = b.slice();
  const p = n[m.path[0]];
  n[m.path[0]] = EMPTY;
  for (const c of m.caps) n[c] = EMPTY;
  n[m.path[m.path.length - 1]] = m.crowns ? (seatOf(p) === 0 ? KING0 : KING1) : p;
  return n;
}

export const samePath = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Finds the legal move with exactly this path, or null. */
export function findMove(b: Board, seat: Seat, path: unknown): DMove | null {
  if (!Array.isArray(path) || path.length < 2 || path.length > 13 || !path.every((x) => Number.isInteger(x) && x >= 0 && x < 64)) return null;
  return legalMoves(b, seat).find((m) => samePath(m.path, path as number[])) ?? null;
}

export function count(b: Board, seat: Seat) {
  return b.filter((p) => p && seatOf(p) === seat).length;
}

/** Square name in the 1..32 standard notation (row 0 holds squares 1..4). */
export function squareNumber(sq: number) {
  return (sq >> 3) * 4 + ((sq & 7) >> 1) + 1;
}

export function notation(m: DMove) {
  return m.path.map(squareNumber).join(m.caps.length ? "x" : "-");
}
