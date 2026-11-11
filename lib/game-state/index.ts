/**
 * Game state (owner request, 11 Nov 2026): every game that is not retired is On, In testing or Off, set by an admin on
 * the Games page and stored in `games.status` ('live', 'testing', 'off'), with the Duels and Parties opt-out in
 * `games.versus`. Pure: the server turns the stored rows into the runtime switch (lib/catalog GameSwitch) that every
 * gate reads, and the admin Games page uses the same words, filters and counts.
 */
import { DEFAULT_SWITCH, GAMES, GAME_BY_ID, isGameState, isRetired, type GameState, type GameSwitch } from "@/lib/catalog";

/** What each state is stored as in `games.status`. */
export const STATUS_OF: Record<GameState, "live" | "testing" | "off"> = { on: "live", testing: "testing", off: "off" };

/**
 * A stored `games.status` as a state. 'coming_soon' (the old lab status) reads as In testing and 'hidden' as Off, so a
 * row the migration has not reached yet is never wider than before. 'retired' and unknown values give undefined: the
 * code decides (retired games are retired in code; a live game keeps its default).
 */
export function stateFromStatus(status: unknown): GameState | undefined {
  if (status === "live") return "on";
  if (status === "testing" || status === "coming_soon") return "testing";
  if (status === "off" || status === "hidden") return "off";
  return undefined;
}

export interface GameStateRow {
  id: string;
  status?: string | null;
  /** "Can be played in Duels and Parties"; missing (before the migration) means yes */
  versus?: boolean | null;
}

/** The runtime switch from the stored rows: a game with no usable row keeps its default (lab games In testing). */
export function switchFromRows(rows: readonly GameStateRow[]): GameSwitch {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const testing: string[] = [];
  const off: string[] = [];
  const noVersus: string[] = [];
  for (const g of GAMES) {
    const r = byId.get(g.id);
    const st = stateFromStatus(r?.status) ?? defaultState(g.id);
    if (st === "testing") testing.push(g.id);
    if (st === "off") off.push(g.id);
    if (r?.versus === false) noVersus.push(g.id);
  }
  return { "games.testing": testing, "games.off": off, "games.noVersus": noVersus };
}

/** A game's state before anyone sets one: lab games start In testing, the rest On. */
export const defaultState = (id: string): GameState => (DEFAULT_SWITCH["games.testing"].includes(id) ? "testing" : "on");

/** The games whose state changed from `before` to `after`: what a switch to In testing or Off takes from players. */
export function closedNow(before: GameSwitch, after: GameSwitch): string[] {
  const shut = (s: GameSwitch, id: string) => s["games.off"].includes(id) || s["games.testing"].includes(id);
  return GAMES.filter((g) => !shut(before, g.id) && shut(after, g.id)).map((g) => g.id);
}

/** The Games page filter: by state, retired games included. */
export const STATE_FILTERS = ["all", "on", "testing", "off", "retired"] as const;
export type StateFilter = (typeof STATE_FILTERS)[number];
export type RowState = GameState | "retired";

/** A Games page row's state (retired in code wins). */
export const rowState = (r: { id: string; retired?: boolean; state?: GameState | null }): RowState =>
  r.retired || isRetired(r.id) ? "retired" : (r.state ?? "on");

/** Rows matching a state filter. */
export const byState = <R extends { id: string; retired?: boolean; state?: GameState | null }>(rows: readonly R[], f: StateFilter): R[] =>
  f === "all" ? [...rows] : rows.filter((r) => rowState(r) === f);

/** How many rows each filter shows. */
export function stateCounts(rows: readonly { id: string; retired?: boolean; state?: GameState | null }[]): Record<StateFilter, number> {
  const c: Record<StateFilter, number> = { all: rows.length, on: 0, testing: 0, off: 0, retired: 0 };
  for (const r of rows) c[rowState(r)]++;
  return c;
}

/** A state change the server accepts: a known state for a game in code that is not retired. */
export function stateChangeProblem(id: string, state: unknown): string | null {
  if (!GAME_BY_ID[id]) return "unknown_game";
  if (isRetired(id)) return "game_retired";
  if (!isGameState(state)) return "invalid_state";
  return null;
}
