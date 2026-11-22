/**
 * Draughts in two sizes (owner, 22 Nov 2026: "add the draughts board size and make the bigger one the default"). The
 * board's length says which rules apply, so a stored match never needs a separate flag:
 *
 * International, 10 × 10 (100 squares, 20 men each), the world federation's game and the one played across Africa:
 * - Men move diagonally forward one square, and capture forward and backward.
 * - Kings fly: they move any distance along a diagonal, and capture a piece any distance away by landing on any
 *   empty square beyond it.
 * - Captures are compulsory, and you must take the line that captures the most pieces (kings count as one).
 * - Captured pieces come off only when the move ends: they can't be jumped twice and still block the way.
 * - A man is crowned only when it ends its move on the far row; passing over it mid-capture is not enough.
 *
 * English, 8 × 8 (64 squares, 12 men each), the game SPUZL played first:
 * - Men move and capture diagonally forward only. Kings move and capture one square in any direction.
 * - Captures are compulsory, but any capturing line may be chosen (no majority rule). Once a line starts it must
 *   be finished while jumps remain.
 * - A man that reaches the far row is crowned and the move ends there, even mid-capture.
 *
 * Both: pieces sit on the dark squares ((row + col) odd), squares are 0..n²-1 with row 0 at the top. Seat 0 starts at
 * the bottom and moves up, and moves first. A player with no legal move loses. (SPUZL paints seat 0 light.)
 */

export const EMPTY = 0;
export const MAN0 = 1,
  KING0 = 2,
  MAN1 = 3,
  KING1 = 4;
export type Seat = 0 | 1;
/** n × n squares (64 English, 100 International), values EMPTY / MAN0 / KING0 / MAN1 / KING1 */
export type Board = number[];
/** The two board sizes: 10 International (the default), 8 English. */
export type DraughtsSize = 8 | 10;
export const DRAUGHTS_SIZES: readonly DraughtsSize[] = [10, 8];
export const DEFAULT_DRAUGHTS_SIZE: DraughtsSize = 10;

export interface DMove {
  /** squares visited: start, then each landing */
  path: number[];
  /** captured squares, in order */
  caps: number[];
  /** the moving man is crowned at the end */
  crowns: boolean;
}

/** The board's side: 10 for a 100-square board, else 8. */
export const sizeOf = (b: readonly number[]): DraughtsSize => (b.length === 100 ? 10 : 8);
/** International rules (flying kings, men capture backward, most captures) on the 10 × 10 board. */
export const isInternational = (b: readonly number[]) => sizeOf(b) === 10;

export const seatOf = (p: number): Seat => (p >= MAN1 ? 1 : 0);
export const isKing = (p: number) => p === KING0 || p === KING1;
export const isDark = (sq: number, n: number = 8) => (Math.floor(sq / n) + (sq % n)) % 2 === 1;
const DIAG: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const forward = (s: Seat) => (s === 0 ? DIAG.slice(0, 2) : DIAG.slice(2));
const crownRow = (s: Seat, n: number) => (s === 0 ? 0 : n - 1);

/** The starting position: 4 rows of men each on 10 × 10, 3 rows on 8 × 8. */
export function initialBoard(n: DraughtsSize = 8): Board {
  const b: Board = new Array(n * n).fill(EMPTY);
  const rows = n === 10 ? 4 : 3;
  for (let sq = 0; sq < n * n; sq++) {
    if (!isDark(sq, n)) continue;
    const r = Math.floor(sq / n);
    if (r < rows) b[sq] = MAN1;
    else if (r >= n - rows) b[sq] = MAN0;
  }
  return b;
}

/** Every complete capture line for the piece on `from` (before the majority rule). */
export function capturesFrom(b: Board, from: number): DMove[] {
  const p = b[from];
  if (!p) return [];
  const n = sizeOf(b);
  const intl = n === 10;
  const me = seatOf(p);
  const king = isKing(p);
  const on = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;
  const out: DMove[] = [];
  // The mover leaves its square; captured pieces stay on the board (they block) until the move ends.
  const work = b.slice();
  work[from] = EMPTY;
  const dirs = king || intl ? DIAG : forward(me);
  const rec = (sq: number, path: number[], caps: number[]) => {
    const r = Math.floor(sq / n),
      c = sq % n;
    let extended = false;
    for (const [dr, dc] of dirs) {
      if (king && intl) {
        // Flying king: slide over empty squares to the first piece, which must be an uncaptured enemy, then land on
        // any empty square beyond it.
        let k = 1;
        while (on(r + k * dr, c + k * dc) && work[(r + k * dr) * n + c + k * dc] === EMPTY) k++;
        if (!on(r + k * dr, c + k * dc)) continue;
        const mid = (r + k * dr) * n + c + k * dc;
        const m = work[mid];
        if (seatOf(m) === me || caps.includes(mid)) continue;
        for (let j = k + 1; on(r + j * dr, c + j * dc); j++) {
          const land = (r + j * dr) * n + c + j * dc;
          if (work[land] !== EMPTY) break;
          extended = true;
          rec(land, [...path, land], [...caps, mid]);
        }
        continue;
      }
      if (!on(r + 2 * dr, c + 2 * dc)) continue;
      const mid = (r + dr) * n + c + dc,
        land = (r + 2 * dr) * n + c + 2 * dc;
      const m = work[mid];
      if (!m || seatOf(m) === me || caps.includes(mid) || work[land] !== EMPTY) continue;
      extended = true;
      const np = [...path, land],
        nc = [...caps, mid];
      // English: a man reaching the far row is crowned and the move ends. International: it carries on capturing.
      if (!king && !intl && Math.floor(land / n) === crownRow(me, n)) out.push({ path: np, caps: nc, crowns: true });
      else rec(land, np, nc);
    }
    if (!extended && caps.length) out.push({ path, caps, crowns: !king && Math.floor(path[path.length - 1] / n) === crownRow(me, n) });
  };
  rec(from, [from], []);
  return out;
}

/** Plain moves (no capture) for the piece on `from`. */
export function simpleFrom(b: Board, from: number): DMove[] {
  const p = b[from];
  if (!p) return [];
  const n = sizeOf(b);
  const intl = n === 10;
  const me = seatOf(p);
  const king = isKing(p);
  const on = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;
  const r = Math.floor(from / n),
    c = from % n;
  const out: DMove[] = [];
  for (const [dr, dc] of king ? DIAG : forward(me)) {
    // A flying king slides as far as the way is clear; everything else steps one square.
    for (let k = 1; on(r + k * dr, c + k * dc); k++) {
      const to = (r + k * dr) * n + c + k * dc;
      if (b[to] !== EMPTY) break;
      out.push({ path: [from, to], caps: [], crowns: !king && Math.floor(to / n) === crownRow(me, n) });
      if (!(king && intl)) break;
    }
  }
  return out;
}

/**
 * Legal moves for `seat`: captures if there are any (compulsory), else plain moves. International keeps only the
 * lines that capture the most pieces.
 */
export function legalMoves(b: Board, seat: Seat): DMove[] {
  let caps: DMove[] = [];
  for (let sq = 0; sq < b.length; sq++) if (b[sq] && seatOf(b[sq]) === seat) caps.push(...capturesFrom(b, sq));
  if (caps.length) {
    if (isInternational(b)) {
      const most = Math.max(...caps.map((m) => m.caps.length));
      caps = caps.filter((m) => m.caps.length === most);
    }
    return caps;
  }
  const simple: DMove[] = [];
  for (let sq = 0; sq < b.length; sq++) if (b[sq] && seatOf(b[sq]) === seat) simple.push(...simpleFrom(b, sq));
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
  // the longest line takes every enemy piece: 20 captures on 10 × 10, 12 on 8 × 8, plus the start
  const most = isInternational(b) ? 21 : 13;
  if (!Array.isArray(path) || path.length < 2 || path.length > most || !path.every((x) => Number.isInteger(x) && x >= 0 && x < b.length))
    return null;
  return legalMoves(b, seat).find((m) => samePath(m.path, path as number[])) ?? null;
}

export function count(b: Board, seat: Seat) {
  return b.filter((p) => p && seatOf(p) === seat).length;
}

/** Square name in the standard numbering: 1..32 on 8 × 8, 1..50 on 10 × 10 (row 0 holds the first squares). */
export function squareNumber(sq: number, n: number = 8) {
  return Math.floor(sq / n) * (n / 2) + Math.floor((sq % n) / 2) + 1;
}

export function notation(m: DMove, n: number = 8) {
  return m.path.map((sq) => squareNumber(sq, n)).join(m.caps.length ? "x" : "-");
}
