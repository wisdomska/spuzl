import { api } from "./api";

/**
 * The practice board for a game, fetched as soon as its Play screen opens (owner, 12 Nov: new devices felt slow).
 * Before, the board was asked for only after /me answered and the screen decided on a practice round: two round
 * trips in a row on every first play, which on a new device is every game. A board fetched and not needed is just
 * dropped (nothing is recorded by the practice round).
 */
type Guided = { puzzle: unknown };
const pending = new Map<string, Promise<Guided>>();

const fetchGuided = (game: string) => api<Guided>(`/api/v1/guided/${game}`);

/** Starts fetching `game`'s practice board, once. */
export function prefetchGuided(game: string) {
  if (!pending.has(game)) {
    const p = fetchGuided(game);
    p.catch(() => pending.delete(game));
    pending.set(game, p);
  }
}

/** The practice board: the prefetched one when there is one (used once), else a fresh request. */
export function takeGuided(game: string): Promise<Guided> {
  const p = pending.get(game);
  pending.delete(game);
  return p ?? fetchGuided(game);
}
