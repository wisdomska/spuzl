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

/**
 * Game-first entry points (SPZ-13). Each opens the mode-first flow with the game preselected:
 *   friend  /duel?game=<id>&invite=1  the challenge-a-friend link is made at once
 *   quick   /duel?game=<id>           Duel entry sheet with the game picked (Quick Match)
 *   party   /party?host=1&game=<id>   Party Host tab with the game picked
 */
export const challengeLinks = (id: string) => ({
  friend: `/duel?game=${encodeURIComponent(id)}&invite=1`,
  quick: `/duel?game=${encodeURIComponent(id)}`,
  party: `/party?host=1&game=${encodeURIComponent(id)}`,
});

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

/** A room's games in one line: the hand-picked names, the one game, or Random mix. */
export function roomGamesName(gameId: string | null | undefined, chosen: readonly string[] | null | undefined): string {
  return chosen?.length ? chosen.map((g) => gameName(g)).join(", ") : gameName(gameId);
}
