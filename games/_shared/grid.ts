/**
 * Small grid helpers shared by Line Lane games (Weave, Pairup, Lost, Flowline). Pure TS.
 * Cells are row-major indexes; directions are 0 N, 1 E, 2 S, 3 W.
 */
import type { Rng } from "@/lib/rng";

export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;
export const DIR_NAME = ["north", "east", "south", "west"] as const;
/** bit per direction: N 1, E 2, S 4, W 8 */
export const BIT = [1, 2, 4, 8] as const;
export const opposite = (d: number) => (d + 2) % 4;

/** Neighbour index in direction d, or -1 off the board. */
export function step(rows: number, cols: number, i: number, d: number): number {
  const r = Math.floor(i / cols) + DR[d], c = (i % cols) + DC[d];
  return r < 0 || c < 0 || r >= rows || c >= cols ? -1 : r * cols + c;
}

export function neighbours(rows: number, cols: number, i: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 4; d++) {
    const j = step(rows, cols, i, d);
    if (j >= 0) out.push(j);
  }
  return out;
}

/** Direction from a to an orthogonally adjacent b, or -1. */
export function dirBetween(cols: number, a: number, b: number): number {
  const ra = Math.floor(a / cols), ca = a % cols, rb = Math.floor(b / cols), cb = b % cols;
  if (ra === rb && cb === ca + 1) return 1;
  if (ra === rb && cb === ca - 1) return 3;
  if (ca === cb && rb === ra + 1) return 2;
  if (ca === cb && rb === ra - 1) return 0;
  return -1;
}

export const adjacent = (cols: number, a: number, b: number) => dirBetween(cols, a, b) >= 0;

/** Canonical key for the edge between two cells. */
export const edgeKey = (a: number, b: number) => (a < b ? a * 1024 + b : b * 1024 + a);

/**
 * Uniform-ish random Hamiltonian path over a rows × cols grid using backbite moves
 * (start from a serpentine, then reverse path prefixes many times).
 */
export function randomHamiltonianPath(rows: number, cols: number, rng: Rng, moves = rows * cols * 40): number[] {
  let path: number[] = [];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) path.push(r * cols + (r % 2 ? cols - 1 - k : k));
  const pos = new Array<number>(rows * cols);
  const reindex = () => path.forEach((cell, i) => (pos[cell] = i));
  reindex();
  for (let m = 0; m < moves; m++) {
    if (rng.chance(0.5)) {
      path.reverse();
      reindex();
    }
    const end = path[0];
    const nb = neighbours(rows, cols, end);
    const v = nb[rng.int(0, nb.length - 1)];
    const i = pos[v];
    if (i <= 1) continue;
    path = path.slice(0, i).reverse().concat(path.slice(i));
    for (let k = 0; k < i; k++) pos[path[k]] = k;
  }
  return path;
}
