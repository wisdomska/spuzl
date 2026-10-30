/**
 * Flip (Reversi / Othello rules), 8 × 8. Squares 0..63 row-major, row 0 at the top.
 * 0 empty, 1 seat 0 (light disc, moves first), 2 seat 1 (dark disc with a ring).
 * A move must outflank at least one rival line; every outflanked line flips. A player with no move
 * passes; the game ends when neither can move, and the most discs wins.
 */
export type Grid = number[];
const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function initialGrid(): Grid {
  const g = new Array(64).fill(0);
  g[27] = 2;
  g[36] = 2;
  g[28] = 1;
  g[35] = 1;
  return g;
}

/** Discs `who` would flip by playing `sq`, in wave order (nearest first). */
export function flipsFor(g: Grid, sq: number, who: number): number[] {
  if (!Number.isInteger(sq) || sq < 0 || sq > 63 || g[sq]) return [];
  const them = 3 - who;
  const r0 = sq >> 3,
    c0 = sq & 7;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr,
      c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && g[r * 8 + c] === them) {
      line.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && g[r * 8 + c] === who) out.push(...line);
  }
  const d = (x: number) => Math.max(Math.abs((x >> 3) - r0), Math.abs((x & 7) - c0));
  return out.sort((a, b) => d(a) - d(b) || a - b);
}

export function legalSquares(g: Grid, who: number): number[] {
  const out: number[] = [];
  for (let sq = 0; sq < 64; sq++) if (!g[sq] && flipsFor(g, sq, who).length) out.push(sq);
  return out;
}

export function place(g: Grid, sq: number, who: number): Grid {
  const flips = flipsFor(g, sq, who);
  if (!flips.length) throw new Error("illegal square");
  const n = g.slice();
  n[sq] = who;
  for (const f of flips) n[f] = who;
  return n;
}

export const countOf = (g: Grid, who: number) => g.filter((x) => x === who).length;
export const sqName = (sq: number) => "abcdefgh"[sq & 7] + String(8 - (sq >> 3));
