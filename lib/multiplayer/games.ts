/**
 * Which games can be raced head to head, and the seeds for each round's shared puzzle.
 * Puzzle Duels and Party Races use grid, word and clue games scored by time. Rage Ridge has its own
 * Ghost Race, Board Bay its own matches, and photosensitive or score-only games stay solo.
 */
import { GAMES, GAME_BY_ID, type GameMeta } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import type { Rng } from "@/lib/rng";

export const RACE_GAMES: GameMeta[] = GAMES.filter(
  (g) => g.world !== "rage" && g.world !== "board" && g.engine !== "phaser" && !g.photosensitive && g.scoring === "time" && hasLogic(g.id),
);
const RACE_IDS = new Set(RACE_GAMES.map((g) => g.id));
export const isRaceGame = (id: string) => RACE_IDS.has(id);

/**
 * Party room picker (Overlays P0, SPZ-13): Random mix plus every race game, in catalog order. The rooms API
 * accepts exactly this set (`isRaceGame`), so the picker and the server can never disagree.
 */
export const PARTY_GAME_IDS: string[] = RACE_GAMES.map((g) => g.id);
/** Duel entry default (Overlays M1 "Sixer | Any game"). */
export const DUEL_DEFAULT_GAME = isRaceGame("sixer") ? "sixer" : RACE_GAMES[0]?.id;

/**
 * A `?game=<id>` query param from a game card (game-first Duel and Party): the id when it can be raced,
 * otherwise null so the screen keeps its own default.
 */
export function raceGameParam(raw: string | null | undefined): string | null {
  return raw && isRaceGame(raw) ? raw : null;
}

/** Games for a match: the chosen game every round, or a seeded mix of different games. */
export function pickGames(rng: Rng, chosen: string | null, rounds: number, allowed?: string[]): string[] {
  if (chosen && isRaceGame(chosen)) return Array.from({ length: rounds }, () => chosen);
  const fromAllowed = (allowed ?? []).filter(isRaceGame);
  const pool = rng.shuffle(fromAllowed.length ? fromAllowed : RACE_GAMES.map((g) => g.id));
  return Array.from({ length: rounds }, (_, i) => pool[i % pool.length]);
}

export const roundSeed = (matchId: string, setNo: number, round: number) => `mp:${matchId}:${setNo}:${round}`;

export function gameName(id: string | null | undefined): string {
  return (id && GAME_BY_ID[id]?.name) || "Random mix";
}
