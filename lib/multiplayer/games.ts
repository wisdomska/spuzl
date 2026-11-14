/**
 * Which games can be raced head to head, and the seeds for each round's shared puzzle.
 * Puzzle Duels and Party Races use grid and word games scored by time. The action courses (Phaser) have their own
 * Ghost Race, Board Games their own matches, and photosensitive games stay solo. Score games race in Party only
 * (R3-08, `SCORE_RACE_GAMES`).
 */
import { GAMES, GAME_BY_ID, openGame, versusAllowed, type GameMeta, type GameSwitch } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-ids";
import type { Rng } from "@/lib/rng";
import { bayGamesFor, type BayGame } from "./bay";

/**
 * Every game that CAN be raced head to head (time races), whatever its state: the eligibility. Who may race it now
 * is `isDuelGame` (On, and the admin hasn't kept it out of Duels and Parties on the Games page).
 */
export const RACE_GAMES: GameMeta[] = GAMES.filter(
  (g) => g.world !== "board" && g.engine !== "phaser" && !g.photosensitive && g.scoring === "time" && hasLogic(g.id),
);
const RACE_IDS = new Set(RACE_GAMES.map((g) => g.id));
/** A game that can be raced (eligibility only; gate rooms on `isDuelGame` / `isPartyGame`). */
export const isRaceGame = (id: string) => RACE_IDS.has(id);

/**
 * Party room picker (Overlays P0, SPZ-13): Random mix plus every race game, in catalog order. Eligibility only: the
 * Host tab lists `partyGames(settings)` and the rooms API checks `isPartyGame`.
 */
export const PARTY_GAME_IDS: string[] = RACE_GAMES.map((g) => g.id);

/**
 * R3-08: score races. Score games a Party may race (most points wins, then the faster finish): every game scored by
 * points that is all ages, not photosensitive, not an action course and not a board game. Party only, never Duels
 * (`isRaceGame` stays time games). Each joins only while it is On and allowed in Duels and Parties (Games page), and
 * all of them only while the admin setting "party.scoreRaces" is on. The server judges each one with the game's own
 * checks (verify, and audit of the server's answer log).
 */
export const SCORE_RACE_GAMES: GameMeta[] = GAMES.filter(
  (g) => g.world !== "board" && g.engine !== "phaser" && !g.photosensitive && g.scoring === "score" && hasLogic(g.id),
);
const SCORE_IDS = new Set(SCORE_RACE_GAMES.map((g) => g.id));
export const isScoreRaceGame = (id: string | null | undefined) => !!id && SCORE_IDS.has(id);

/** Games the Games page offers "Can be played in Duels and Parties" for: time races and score races. */
export const isVersusEligible = (id: string) => isRaceGame(id) || isScoreRaceGame(id);

/**
 * A game players may race in a Duel or a Party now: eligible, On (Games page state; a game In testing or Off never
 * races, not even for admins), and not kept out of Duels and Parties.
 */
export const versusOpen = (id: string, s: GameSwitch) => !!openGame(id, s) && versusAllowed(id, s);

/** A time race game players may pick for a Duel (or a Party) now. */
export const isDuelGame = (id: string | null | undefined, s: GameSwitch) => !!id && isRaceGame(id) && versusOpen(id, s);
/** Every time race game players may pick now, in catalogue order (Duel picker). */
export const duelGames = (s: GameSwitch): GameMeta[] => RACE_GAMES.filter((g) => versusOpen(g.id, s));

/** The settings a Party's game list reads. */
export type PartyGameSwitch = GameSwitch & { readonly "party.scoreRaces": boolean };

/** Score games a host may pick now: the setting on, and the game open for Duels and Parties. */
export const scoreRaceGames = (s: PartyGameSwitch): GameMeta[] =>
  s["party.scoreRaces"] ? SCORE_RACE_GAMES.filter((g) => versusOpen(g.id, s)) : [];

/** Every game a host may pick for a Party now (time races, then score races), in catalogue order within each. */
export const partyGames = (s: PartyGameSwitch): GameMeta[] => [...duelGames(s), ...scoreRaceGames(s)];

/** The server's check for a Party game: a time race game, or a score race game, open for Duels and Parties now. */
export const isPartyGame = (id: string, s: PartyGameSwitch) =>
  isDuelGame(id, s) || (isScoreRaceGame(id) && s["party.scoreRaces"] && versusOpen(id, s));

/**
 * Board games a Party host can start for `n` players (owner, 14 Nov 2026: "if I select party mode and change the players
 * to 4, some of the board games can be made available as well"): the Board Bay games that seat exactly that many and
 * are On now. Picking one opens a live Board Bay game with that many seats and its invite code, not a race room.
 */
export const partyBoardGames = (n: number, s: GameSwitch): BayGame[] => bayGamesFor(n).filter((g) => !!openGame(g, s));

/**
 * R4-08: a `?game=<id>` param for the Party Host tab: a time race game, or a score race game open now (the same
 * check the server makes), otherwise null.
 */
export const partyGameParam = (raw: string | null | undefined, s: PartyGameSwitch): string | null =>
  raw && isPartyGame(raw, s) ? raw : null;

/** Duel entry default (Overlays M1 "Sixer | Any game"); screens check it is open now (`isDuelGame`). */
export const DUEL_DEFAULT_GAME = isRaceGame("sixer") ? "sixer" : RACE_GAMES[0]?.id;

/**
 * A `?game=<id>` query param from a game card (game-first Duel and Party): the id when it can be raced now,
 * otherwise null so the screen keeps its own default.
 */
export function raceGameParam(raw: string | null | undefined, s: GameSwitch): string | null {
  return raw && isDuelGame(raw, s) ? raw : null;
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
 * used now: a Duel passes `isDuelGame`, a Party start `isPartyGame`, both with the live settings, so a game switched
 * Off, to In testing or out of Duels and Parties never races; score races (R3-08) count in Parties while they are
 * switched on. A Random mix is always time races that pass `ok`. Empty when no game is left to race.
 */
export function pickGames(
  rng: Rng,
  chosen: string | null,
  rounds: number,
  allowed: string[] | undefined,
  ok: (id: string) => boolean,
): string[] {
  if (chosen && ok(chosen)) return Array.from({ length: rounds }, () => chosen);
  const fromAllowed = (allowed ?? []).filter(ok);
  const pool = rng.shuffle(fromAllowed.length ? fromAllowed : RACE_GAMES.map((g) => g.id).filter(ok));
  if (!pool.length) return [];
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
