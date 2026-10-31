/**
 * Duel matchmaking by duel rating and region (SRS 12.2). The rating window starts tight and widens
 * the longer either player waits; the same region is preferred, then the closest rating, then the
 * longest wait. Pure, so the server and the tests share it.
 */
import { TIMING } from "./constants";

export interface QueueEntry {
  playerId: string;
  /** null = any game */
  gameId: string | null;
  rating: number;
  region: string | null;
  enqueuedAt: number;
}

/** Allowed rating gap after waiting `waitMs`: 100 at first, +25 per second, capped at 600. */
export function ratingWindow(waitMs: number): number {
  return Math.min(600, 100 + Math.max(0, waitMs) * 0.025);
}

export function gamesCompatible(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/** The game both players get: the specific one if either chose it, otherwise null (server picks). */
export function agreedGame(a: string | null, b: string | null): string | null {
  return a ?? b;
}

export function compatible(me: QueueEntry, other: QueueEntry, now: number): boolean {
  if (me.playerId === other.playerId) return false;
  if (!gamesCompatible(me.gameId, other.gameId)) return false;
  // Either player's (wider) window is enough, so a long-waiting player can still be found.
  const window = Math.max(ratingWindow(now - me.enqueuedAt), ratingWindow(now - other.enqueuedAt));
  return Math.abs(me.rating - other.rating) <= window;
}

/** Best opponent for `me` among waiting entries, or null. */
export function pickOpponent(me: QueueEntry, waiting: QueueEntry[], now: number): QueueEntry | null {
  let best: QueueEntry | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const o of waiting) {
    if (!compatible(me, o, now)) continue;
    const key: [number, number, number] = [me.region && o.region === me.region ? 0 : 1, Math.abs(me.rating - o.rating), o.enqueuedAt];
    if (
      !bestKey ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
    ) {
      best = o;
      bestKey = key;
    }
  }
  return best;
}

/** After 20 s with nobody found the player is offered the clearly labelled Practice bot. */
export function botDue(enqueuedAt: number, now: number): boolean {
  return now - enqueuedAt >= TIMING.botAfterMs;
}

/** "Usual wait" shown on D1, from recent pair times (ms). Median, rounded to seconds, default 12 s. */
export function usualWaitMs(recent: number[]): number {
  if (!recent.length) return 12_000;
  const s = [...recent].sort((a, b) => a - b);
  const m = s[Math.floor(s.length / 2)];
  return Math.round(m / 1000) * 1000;
}
