/**
 * Oware, Abapa rules (the Ghanaian standard, as the design labels it).
 *
 * Pits 0..5 belong to seat 0 (bottom row, left to right), 6..11 to seat 1 (top row, right to left),
 * so sowing anticlockwise is increasing index. 4 seeds per pit, 48 in all.
 * - Sow every seed from one of your pits, one per pit anticlockwise. A pit of 12 or more seeds laps
 *   the board and skips the pit it came from.
 * - If the last seed lands in a rival pit that now holds 2 or 3, capture it, then keep capturing the
 *   pits before it (clockwise) on the rival side while they hold 2 or 3.
 * - Grand slam: a move that would capture every seed on the rival side is played but captures nothing.
 * - You must feed a rival whose side is empty if any move can. If none can, the game ends and you
 *   take the seeds on your own side.
 * - 25 seeds wins; 24 each is a draw. If no capture happens for 100 plies (an endless cycle), the
 *   game ends and each player takes the seeds on their own side.
 */

export type Seat = 0 | 1;
export const PITS = 12;
export const own = (seat: Seat, pit: number) => (seat === 0 ? pit < 6 : pit >= 6);
export const sideOf = (pit: number): Seat => (pit < 6 ? 0 : 1);
export const sideSeeds = (pits: readonly number[], seat: Seat) => pits.slice(seat * 6, seat * 6 + 6).reduce((a, b) => a + b, 0);

export interface SowResult {
  pits: number[];
  /** pits that received a seed, in order (with repeats on laps) */
  path: number[];
  last: number;
  /** captured pits in capture order (clockwise from the last pit), empty on a grand slam */
  captured: number[];
  gain: number;
  grandSlam: boolean;
}

export function sow(pits: readonly number[], pit: number): SowResult {
  const out = pits.slice();
  let seeds = out[pit];
  out[pit] = 0;
  const path: number[] = [];
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % PITS;
    if (i === pit) continue;
    out[i]++;
    path.push(i);
    seeds--;
  }
  const me = sideOf(pit);
  const captured: number[] = [];
  let k = i;
  while (sideOf(k) !== me && (out[k] === 2 || out[k] === 3)) {
    captured.push(k);
    if (k % 6 === 0) break; // first pit of the rival row: the capture run stops at the side boundary
    k--;
  }
  const gain = captured.reduce((s, p) => s + out[p], 0);
  const rival = (1 - me) as Seat;
  const grandSlam = captured.length > 0 && gain === sideSeeds(out, rival);
  if (!grandSlam) for (const p of captured) out[p] = 0;
  return { pits: out, path, last: i, captured: grandSlam ? [] : captured, gain: grandSlam ? 0 : gain, grandSlam };
}

/** Legal pits for `seat`, honouring the must-feed rule. */
export function legalPits(pits: readonly number[], seat: Seat): number[] {
  const mine = Array.from({ length: 6 }, (_, k) => seat * 6 + k).filter((p) => pits[p] > 0);
  const rival = (1 - seat) as Seat;
  if (sideSeeds(pits, rival) > 0) return mine;
  return mine.filter((p) => sideSeeds(sow(pits, p).pits, rival) > 0);
}

/** Pits shown on the board, top row then bottom row, left to right. */
export const TOP_ROW = [11, 10, 9, 8, 7, 6];
export const BOTTOM_ROW = [0, 1, 2, 3, 4, 5];
