/**
 * Which games can be raced head to head, and the seeds for each round's shared puzzle.
 * Puzzle Duels and Party Races use grid and word games scored by time. The action courses (Phaser) have their own
 * Ghost Race, Board Games their own matches, and photosensitive games stay solo. Score games race in Party only
 * (R3-08, `SCORE_RACE_GAMES`).
 */
import { GAMES, GAME_BY_ID, LAB_GAMES, openGame, type GameMeta, type LabSwitch } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-ids";
import type { Rng } from "@/lib/rng";

export const RACE_GAMES: GameMeta[] = GAMES.filter(
  (g) => g.world !== "board" && g.engine !== "phaser" && !g.photosensitive && g.scoring === "time" && hasLogic(g.id),
);
const RACE_IDS = new Set(RACE_GAMES.map((g) => g.id));
export const isRaceGame = (id: string) => RACE_IDS.has(id);

/**
 * Party room picker (Overlays P0, SPZ-13): Random mix plus every race game, in catalog order. The rooms API
 * accepts exactly this set (`isRaceGame`), so the picker and the server can never disagree.
 */
export const PARTY_GAME_IDS: string[] = RACE_GAMES.map((g) => g.id);

/**
 * R3-08: score races. Score games a Party may race (most points wins, then the faster finish): every live or lab
 * game scored by points that is all ages, not photosensitive, not an action course and not a board game. Party
 * only, never Duels (`isRaceGame` stays time games). A lab game joins only while "features.labGames" has it, the
 * same rule as everywhere else (`openGame`), and all of them only while the admin setting "party.scoreRaces" is on.
 * The server judges each one with the game's own checks (verify, and audit of the server's answer log).
 */
export const SCORE_RACE_GAMES: GameMeta[] = [...GAMES, ...LAB_GAMES].filter(
  (g) => g.world !== "board" && g.engine !== "phaser" && !g.photosensitive && g.scoring === "score" && hasLogic(g.id),
);
const SCORE_IDS = new Set(SCORE_RACE_GAMES.map((g) => g.id));
export const isScoreRaceGame = (id: string | null | undefined) => !!id && SCORE_IDS.has(id);

/** The settings a Party's game list reads. */
export type PartyGameSwitch = LabSwitch & { readonly "party.scoreRaces": boolean };

/** Score games a host may pick now: the setting on, and a lab game only while it is switched on. */
export const scoreRaceGames = (s: PartyGameSwitch): GameMeta[] =>
  s["party.scoreRaces"] ? SCORE_RACE_GAMES.filter((g) => !!openGame(g.id, s)) : [];

/** Every game a host may pick for a Party now (time races, then score races), in catalogue order within each. */
export const partyGames = (s: PartyGameSwitch): GameMeta[] => [...RACE_GAMES, ...scoreRaceGames(s)];

/** The server's check for a Party game: a time race game, or a score race game open now. */
export const isPartyGame = (id: string, s: PartyGameSwitch) =>
  isRaceGame(id) || (isScoreRaceGame(id) && s["party.scoreRaces"] && !!openGame(id, s));

/**
 * R4-08: a `?game=<id>` param for the Party Host tab: a time race game, or a score race game open now (the same
 * check the server makes), otherwise null.
 */
export const partyGameParam = (raw: string | null | undefined, s: PartyGameSwitch): string | null =>
  raw && isPartyGame(raw, s) ? raw : null;

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

/**
 * Games for a match: the chosen game every round, or a seeded mix of different games. `ok` says which games may be
 * used: time races by default (Duels); a Party start passes `isPartyGame` with the live settings, so score races
 * (R3-08) count there while they are switched on. A Random mix is always time races.
 */
export function pickGames(
  rng: Rng,
  chosen: string | null,
  rounds: number,
  allowed?: string[],
  ok: (id: string) => boolean = isRaceGame,
): string[] {
  if (chosen && ok(chosen)) return Array.from({ length: rounds }, () => chosen);
  const fromAllowed = (allowed ?? []).filter(ok);
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
