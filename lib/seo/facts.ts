/**
 * Site-wide facts the public copy states (lib/copy/seo.ts FEATURES and the FAQ, the guides, llms.txt), read from the
 * code and the admin's switches, so a page never claims a mode that is switched off or a game that is not On.
 * - flags: the Game settings switches public copy depends on (Daily Five, score races, the Party TV view, friend
 *   challenges, Draw It and Two Truths). Public pages get them with the games' state (`servedGameSwitch`); without
 *   them, the setting defaults apply (lib/game-settings/schema.ts).
 * - bay, partyBoards, ghost: the Board Bay games, the board games a Party room can open and the Ghost Race tracks,
 *   only the ones that are On.
 * Imports only the catalog, the settings schema and the multiplayer rules, so lib/copy/seo.ts can use it.
 */
import { DEFAULT_SWITCH, GAME_BY_ID, openGame, type GameSwitch } from "@/lib/catalog";
import { DEFAULTS, type GameSettings } from "@/lib/game-settings/schema";
import { BAY_GAMES } from "@/lib/multiplayer/bay";
import { PARTY_MAX, PARTY_MIN } from "@/lib/multiplayer/constants";
import { GHOST_TRACKS, partyBoardGames } from "@/lib/multiplayer/games";

/** The Game settings switches that change what public pages may claim. */
export const PUBLIC_FLAG_KEYS = [
  "dailyFive.enabled",
  "party.scoreRaces",
  "features.partyTv",
  "features.challenges",
  "features.adultParty",
  "party.familyDraw",
] as const;
export type PublicFlagKey = (typeof PUBLIC_FLAG_KEYS)[number];

/** The games' state plus those switches: what the public pages are built from (`servedGameSwitch`). */
export type PublicSwitch = GameSwitch & Partial<Pick<GameSettings, PublicFlagKey>>;

export interface SiteFlags {
  /** Daily Five is on (dailyFive.enabled) */
  dailyFive: boolean;
  /** score games (Quickfire and the like) can race in Party (party.scoreRaces) */
  scoreRaces: boolean;
  /** the Party big-screen view (features.partyTv) */
  partyTv: boolean;
  /** "beat my time" challenge links (features.challenges) */
  challenges: boolean;
  /** Draw It and Two Truths party modes for 18 and over (features.adultParty) */
  adultParty: boolean;
  /** Draw It with preset words for 16 and over (party.familyDraw) */
  familyDraw: boolean;
}

export const flagsOf = (s?: Partial<PublicSwitch>): SiteFlags => {
  const on = (k: PublicFlagKey) => (s?.[k] ?? DEFAULTS[k]) === true;
  return {
    dailyFive: on("dailyFive.enabled"),
    scoreRaces: on("party.scoreRaces"),
    partyTv: on("features.partyTv"),
    challenges: on("features.challenges"),
    adultParty: on("features.adultParty"),
    familyDraw: on("party.familyDraw"),
  };
};

/** Board games a Party room can open: the player counts that share one list, e.g. { players: [2], games: [...] }. */
export interface PartyBoards {
  players: number[];
  games: string[];
}

export interface SiteFacts {
  flags: SiteFlags;
  /** Board Bay games that are On (names, catalogue order) */
  bay: string[];
  /** Board games a Party host can start, grouped by player count (lib/multiplayer/games `partyBoardGames`) */
  partyBoards: PartyBoards[];
  /** Ghost Race tracks that are On (names) */
  ghost: string[];
}

const nameOf = (id: string) => GAME_BY_ID[id]?.name ?? id;

/** The facts for a switch (the games' state and, where known, the settings); the defaults when none is given. */
export function siteFacts(s: PublicSwitch = DEFAULT_SWITCH): SiteFacts {
  const partyBoards: PartyBoards[] = [];
  for (let n = PARTY_MIN; n <= PARTY_MAX; n++) {
    const games = partyBoardGames(n, s).map(nameOf);
    if (!games.length) continue;
    const last = partyBoards.at(-1);
    if (last && last.games.join() === games.join() && last.players.at(-1) === n - 1) last.players.push(n);
    else partyBoards.push({ players: [n], games });
  }
  return {
    flags: flagsOf(s),
    bay: BAY_GAMES.filter((g) => !!openGame(g, s)).map(nameOf),
    partyBoards,
    ghost: GHOST_TRACKS.filter((g) => !!openGame(g, s)).map(nameOf),
  };
}
