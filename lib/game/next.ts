import { GAMES, GAME_BY_ID, LAUNCH_IDS, WORLD_BY_ID, playableGame } from "@/lib/catalog";
import { isLadderGame } from "./levels";

/**
 * The other game a results screen offers after `current`: the next game after it in its own category (wrapping
 * round), preferring one not cleared yet and ready to play. Never the game just played, and never a jump back to
 * the start of the Dailies list (that sent every non-Daily game to Crownfall).
 */
export function nextInPath(current: string, cleared: Record<string, unknown>, ready: (id: string) => boolean): string | null {
  const meta = GAME_BY_ID[current];
  if (!meta) return null;
  const world = GAMES.filter((g) => g.world === meta.world);
  const i = world.findIndex((g) => g.id === current);
  const after = [...world.slice(i + 1), ...world.slice(0, Math.max(0, i))].map((g) => g.id).filter((id) => id !== current);
  return after.find((id) => cleared[id] === undefined && ready(id)) ?? after.find((id) => ready(id)) ?? after[0] ?? null;
}

/** "Next in Puzzles: Dusk" */
export function nextLabel(id: string): string {
  const g = GAME_BY_ID[id];
  return `Next in ${WORLD_BY_ID[g.world].name}: ${g.name}`;
}

/**
 * The same, split for a two-line button: the game first ("Next: Emoji Hits"), its category under it
 * ("Words & Quiz"). `full` stays the button's accessible name.
 */
export function nextLabelParts(id: string): { title: string; sub: string; full: string } {
  const g = GAME_BY_ID[id];
  return { title: `Next: ${g.name}`, sub: WORLD_BY_ID[g.world].name, full: nextLabel(id) };
}

/**
 * Home's Continue: the game the player played most recently. A brand-new player (nothing played yet) gets the
 * first Daily that is ready, as before.
 */
export function continueGame(recent: readonly string[] | undefined, fallback: string | null): string | null {
  return (recent ?? []).find((id) => !!playableGame(id)) ?? fallback;
}

/** Where Continue opens a game: its next level for games with levels, else a fresh puzzle (or today's Daily). */
export function continueHref(id: string, o: { dailiesOn: boolean; clearedToday: boolean }): string {
  if (isLadderGame(id)) return `/play/${id}?mode=level`;
  if (o.dailiesOn && !o.clearedToday && (LAUNCH_IDS as readonly string[]).includes(id)) return `/play/${id}`;
  return `/play/${id}?mode=free`;
}
