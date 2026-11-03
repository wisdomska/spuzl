/**
 * Board Bay "Play live" matchmaking. Two players waiting for the same game are paired into a live (timed)
 * Board Bay match. When both already have a rating for that game, the closest rating wins, inside a window
 * that widens the longer either of them waits; otherwise it is first come, first served. Blocked players are
 * never paired, and an entry whose player stopped polling (left, closed the tab) is skipped.
 * Pure, so the server and the tests share it.
 */
import type { BayGame } from "./bay";

export const BAY_QUEUE = {
  /** stop searching after this long and offer a friend invite or the Practice bot */
  timeoutMs: 60_000,
  /** the client polls about once a second; an entry not seen for this long belongs to someone who left */
  staleMs: 12_000,
  /** client poll interval */
  pollMs: 1_000,
} as const;

export interface BayQueueEntry {
  playerId: string;
  game: BayGame;
  /** board:<game> rating (1000 when the player has none yet) */
  rating: number;
  /** false until the player has a rated result in this game */
  hasRating: boolean;
  enqueuedAt: number;
  /** last poll */
  seenAt: number;
}

/** Allowed rating gap between two rated players after waiting `waitMs`: 150 at first, +10 a second, open at 30 s. */
export function bayRatingWindow(waitMs: number): number {
  const w = Math.max(0, waitMs);
  if (w >= 30_000) return Infinity;
  return 150 + w * 0.01;
}

/** Still searching: polled recently and not past the search time limit. */
export function isLive(e: BayQueueEntry, now: number): boolean {
  return now - e.seenAt < BAY_QUEUE.staleMs && now - e.enqueuedAt < BAY_QUEUE.timeoutMs;
}

export function searchTimedOut(enqueuedAt: number, now: number): boolean {
  return now - enqueuedAt >= BAY_QUEUE.timeoutMs;
}

/** True when either player blocked the other. `blocks` holds [blocker, blocked] pairs. */
export function blockedPair(a: string, b: string, blocks: ReadonlyArray<readonly [string, string]>): boolean {
  return blocks.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export function bayCompatible(
  me: BayQueueEntry,
  other: BayQueueEntry,
  now: number,
  blocks: ReadonlyArray<readonly [string, string]> = [],
): boolean {
  if (me.playerId === other.playerId) return false;
  if (me.game !== other.game) return false;
  if (!isLive(me, now) || !isLive(other, now)) return false;
  if (blockedPair(me.playerId, other.playerId, blocks)) return false;
  if (me.hasRating && other.hasRating) {
    // Either player's (wider) window is enough, so a long-waiting player is still found.
    const window = Math.max(bayRatingWindow(now - me.enqueuedAt), bayRatingWindow(now - other.enqueuedAt));
    return Math.abs(me.rating - other.rating) <= window;
  }
  return true;
}

/**
 * Best opponent for `me`, or null. Both rated: the closest rating first. Otherwise (or on a tie) the
 * longest wait first, so it is first come, first served.
 */
export function pickBayOpponent(
  me: BayQueueEntry,
  waiting: BayQueueEntry[],
  now: number,
  blocks: ReadonlyArray<readonly [string, string]> = [],
): BayQueueEntry | null {
  let best: BayQueueEntry | null = null;
  let bestKey: [number, number] | null = null;
  for (const o of waiting) {
    if (!bayCompatible(me, o, now, blocks)) continue;
    const gap = me.hasRating && o.hasRating ? Math.abs(me.rating - o.rating) : 0;
    const key: [number, number] = [gap, o.enqueuedAt];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = o;
      bestKey = key;
    }
  }
  return best;
}

/** Who takes seat 0 (moves first in every Board Bay game): a fair coin, from a number in [0, 1). */
export function seatOrder<T>(a: T, b: T, coin: number): [T, T] {
  return coin < 0.5 ? [a, b] : [b, a];
}
