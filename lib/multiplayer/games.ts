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

/** Party room picker (Overlays P0): Random mix plus these, in design order. */
export const ROOM_PICKS = ["quads", "crownfall", "sixer", "deadon", "echo"].filter(isRaceGame);
/** Duel entry default (Overlays M1 "Sixer | Any game"). */
export const DUEL_DEFAULT_GAME = isRaceGame("sixer") ? "sixer" : RACE_GAMES[0]?.id;

/** Games for a match: the chosen game every round, or a seeded mix of different games. */
export function pickGames(rng: Rng, chosen: string | null, rounds: number): string[] {
  if (chosen && isRaceGame(chosen)) return Array.from({ length: rounds }, () => chosen);
  const pool = rng.shuffle(RACE_GAMES.map((g) => g.id));
  return Array.from({ length: rounds }, (_, i) => pool[i % pool.length]);
}

export const roundSeed = (matchId: string, setNo: number, round: number) => `mp:${matchId}:${setNo}:${round}`;

export function gameName(id: string | null | undefined): string {
  return (id && GAME_BY_ID[id]?.name) || "Random mix";
}
