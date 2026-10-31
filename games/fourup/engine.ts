/**
 * Four Up (four in a row), 7 columns × 6 rows. Cells 0..41 row-major, row 0 at the top.
 * 0 empty, 1 seat 0 (star disc), 2 seat 1 (ring disc). Discs drop to the lowest empty cell.
 */
export const COLS = 7,
  ROWS = 6;
export type Grid = number[];

export const emptyGrid = (): Grid => new Array(COLS * ROWS).fill(0);

/** Row the next disc in `col` lands on, or -1 when the column is full. */
export function dropRow(g: Grid, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let r = ROWS - 1; r >= 0; r--) if (!g[r * COLS + col]) return r;
  return -1;
}

export function openCols(g: Grid): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (!g[c]) out.push(c);
  return out;
}

export function drop(g: Grid, col: number, who: number): Grid {
  const r = dropRow(g, col);
  if (r < 0) throw new Error("column full");
  const n = g.slice();
  n[r * COLS + col] = who;
  return n;
}

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** The four-or-more line through `cell`, or null. */
export function lineThrough(g: Grid, cell: number): number[] | null {
  const who = g[cell];
  if (!who) return null;
  const r0 = Math.floor(cell / COLS),
    c0 = cell % COLS;
  for (const [dr, dc] of DIRS) {
    const line = [cell];
    for (const s of [1, -1]) {
      let r = r0 + dr * s,
        c = c0 + dc * s;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && g[r * COLS + c] === who) {
        line.push(r * COLS + c);
        r += dr * s;
        c += dc * s;
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a - b);
  }
  return null;
}

export function winner(g: Grid): { who: number; line: number[] } | null {
  for (let i = 0; i < g.length; i++) {
    const l = g[i] ? lineThrough(g, i) : null;
    if (l) return { who: g[i], line: l };
  }
  return null;
}

/** Drops for `me` and reports whether that disc completes four. */
export function dropWins(g: Grid, col: number, me: number): boolean {
  const r = dropRow(g, col);
  if (r < 0) return false;
  const n = g.slice();
  n[r * COLS + col] = me;
  return lineThrough(n, r * COLS + col) !== null;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];

/** Can `me` (to move) force four within `n` of its own drops? */
export function winIn(g: Grid, me: number, n: number): boolean {
  if (n <= 0) return false;
  for (const c of ORDER) {
    if (dropRow(g, c) < 0) continue;
    if (dropWins(g, c, me)) return true;
  }
  if (n === 1) return false;
  for (const c of ORDER) {
    if (dropRow(g, c) < 0) continue;
    if (rivalLost(drop(g, c, me), me, n - 1)) return true;
  }
  return false;
}

/** Rival to move after `me` dropped: does every reply leave `me` a win within k? */
export function rivalLost(g: Grid, me: number, k: number): boolean {
  const them = 3 - me;
  const cols = openCols(g);
  if (!cols.length) return false;
  // If the rival can win at once, it will.
  for (const c of cols) if (dropWins(g, c, them)) return false;
  for (const c of cols) if (!winIn(drop(g, c, them), me, k)) return false;
  return true;
}

/** First drops that force a win within n. */
export function winningCols(g: Grid, me: number, n: number): number[] {
  return openCols(g).filter((c) => dropWins(g, c, me) || (n > 1 && rivalLost(drop(g, c, me), me, n - 1)));
}

export function winDistance(g: Grid, me: number, max: number): number {
  for (let n = 1; n <= max; n++) if (winIn(g, me, n)) return n;
  return 0;
}

/** Rival reply in a lost position: delays the win longest; ties prefer blocking, then the centre. */
export function bestDefence(g: Grid, me: number, k: number): number {
  const them = 3 - me;
  let best = -1,
    bestD = -1,
    bestBlock = false;
  for (const c of ORDER) {
    if (dropRow(g, c) < 0) continue;
    const a = drop(g, c, them);
    const d = winDistance(a, me, k) || k + 1;
    const block = dropWins(g, c, me);
    if (d > bestD || (d === bestD && block && !bestBlock)) {
      best = c;
      bestD = d;
      bestBlock = block;
    }
  }
  return best;
}
