/**
 * Facts about each game for the public game pages, JSON-LD and llms.txt. Everything is derived from the code
 * (catalog flags, level ladders, multiplayer rules, default play times), so a page can never claim a mode the game
 * does not have. Only games that are On show (Games page state, `openGame`): a game In testing or Off never does.
 */
import {
  DEFAULT_SWITCH,
  WORLD_BY_ID,
  openGame,
  playerGames,
  playerGamesInWorld,
  playerWorlds,
  versusAllowed,
  type GameMeta,
  type GameSwitch,
  type WorldId,
} from "@/lib/catalog";
import { durationLabel, defaultMetaFor } from "@/lib/games-meta";
import { SEEDED_LADDERS, isLadderGame, levelCount } from "@/lib/game/levels";
import { GHOST_TRACKS, isRaceGame, isScoreRaceGame } from "@/lib/multiplayer/games";
import { BAY_SEATS, isBayGame } from "@/lib/multiplayer/bay";
import { PARTY_MAX } from "@/lib/multiplayer/constants";
import { GAME_SEO, controlsOf, definitionOf, gamesCopy as T, kindOf, scoringOf, worldNamesOf, type QA } from "@/lib/copy/seo";
import { flagsOf, type PublicSwitch } from "./facts";

/**
 * Ways to play a game. "party" is a Party race (time races, and score games while score races are on);
 * "partyBoard" a board game a Party room can open for its players; "ghost" a Ghost Race track.
 */
export type GameMode = "free" | "levels" | "duel" | "party" | "ghost" | "bay" | "partyBoard" | "bot";

export interface GameFacts {
  game: GameMeta;
  worldName: string;
  kind: string;
  definition: string;
  typicalSec: number;
  /** "About 2 min" / "Under 1 min" */
  typicalLabel: string;
  /** Pool ladder size; null for an endless (seeded) ladder; undefined when the game has no Levels mode. */
  levels: number | null | undefined;
  /** Free play offers Easy to Expert (the generated puzzle games). */
  difficulty: boolean;
  modes: GameMode[];
  modeLines: string[];
  /** Most players in one game (a Party race, a board game's seats); undefined for solo games. */
  maxPlayers: number | undefined;
  controls: string;
  scoring: string;
  faq: QA[];
  related: GameMeta[];
}

/** Every game On (the default before the database answers): what the public pages show without a switch. */
export const LIVE_ONLY: GameSwitch = DEFAULT_SWITCH;

/** The game for a public page: On; undefined for unknown, retired, In testing and Off ids (the player view). */
export const publicGame = (id: string, s: GameSwitch = LIVE_ONLY): GameMeta | undefined => openGame(id, s);
/** Every game on the public pages: the ones that are On. */
export const publicGames = (s: GameSwitch = LIVE_ONLY): GameMeta[] => playerGames(s);
/** A world's games on the public pages: its games that are On (as on the World screen). */
export const publicGamesInWorld = (w: WorldId, s: GameSwitch = LIVE_ONLY): GameMeta[] => playerGamesInWorld(w, s);

/** "2 players", "2 to 4 players": the seats of a Board Bay game (what a Party room needs to open it). */
const seatsText = (id: string) => {
  const s = isBayGame(id) ? BAY_SEATS[id] : undefined;
  return !s ? "" : s.min === s.max ? `${s.min} players` : `${s.min} to ${s.max} players`;
};

export function gameModes(g: GameMeta, s: PublicSwitch = LIVE_ONLY): GameMode[] {
  const m: GameMode[] = ["free"];
  if (isLadderGame(g.id)) m.push("levels");
  // A game the admin keeps out of Duels and Parties (Games page) doesn't claim them.
  if (isRaceGame(g.id) && versusAllowed(g.id, s)) m.push("duel", "party");
  // Score games race in Party only, while the admin's score races switch is on (lib/multiplayer/games scoreRaceGames).
  else if (isScoreRaceGame(g.id) && versusAllowed(g.id, s) && flagsOf(s).scoreRaces) m.push("party");
  if ((GHOST_TRACKS as readonly string[]).includes(g.id)) m.push("ghost");
  // Board Bay games: with a friend, and from a Party room with exactly their seats (partyBoardGames).
  if (isBayGame(g.id)) m.push("bay", "partyBoard");
  if (g.botPlay) m.push("bot");
  return m;
}

export function gameFacts(g: GameMeta, lab: PublicSwitch = LIVE_ONLY): GameFacts {
  const typicalSec = defaultMetaFor(g.id).typicalSec;
  const label = durationLabel(typicalSec);
  const levels = isLadderGame(g.id) ? levelCount(g.id) : undefined;
  const modes = gameModes(g, lab);
  const score = isScoreRaceGame(g.id);
  const modeLines = modes.map((m) =>
    m === "free"
      ? T.modes.free(g)
      : m === "levels"
        ? levels
          ? T.modes.levelsPool(levels)
          : T.modes.levelsEndless
        : m === "party"
          ? score
            ? T.modes.scoreParty
            : T.modes.party
          : m === "partyBoard"
            ? T.modes.partyBoard(g, seatsText(g.id))
            : T.modes[m],
  );
  const faq: QA[] = [T.faq.free(g), T.faq.time(g, label), T.faq.account(g)];
  if (levels) faq.push(T.faq.levelsPool(g, levels));
  else if (levels === null) faq.push(T.faq.levelsEndless(g));
  if (modes.includes("duel")) faq.push(T.faq.friendsRace(g));
  else if (modes.includes("party")) faq.push(T.faq.friendsParty(g));
  else if (modes.includes("bay")) faq.push(T.faq.friendsBay(g));
  else if (modes.includes("ghost")) faq.push(T.faq.friendsGhost(g));
  if (faq.length < 5) faq.push(T.faq.phone(g));
  const maxPlayers = modes.includes("party") ? PARTY_MAX : isBayGame(g.id) ? BAY_SEATS[g.id].max : modes.includes("duel") ? 2 : undefined;
  return {
    game: g,
    worldName: WORLD_BY_ID[g.world].name,
    kind: kindOf(g),
    definition: definitionOf(g),
    typicalSec,
    typicalLabel: T.facts.timeValue(label),
    levels,
    difficulty: (SEEDED_LADDERS as readonly string[]).includes(g.id),
    modes,
    modeLines,
    maxPlayers,
    controls: controlsOf(g),
    scoring: scoringOf(g),
    faq: faq.slice(0, 5),
    related: publicGamesInWorld(g.world, lab).filter((x) => x.id !== g.id),
  };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "<Game>: free online <kind> | SPUZL", kept under 60 characters (drops "online", then the kind, if needed). A game
 * with its own search title (GAME_SEO `title`, e.g. "Play Oware online free ...") uses that.
 */
export function gameTitle(g: GameMeta): string {
  const kind = kindOf(g);
  const own = GAME_SEO[g.id]?.title;
  const tries = [
    ...(own ? [own] : []),
    `${g.name}: free online ${kind} | SPUZL`,
    `${g.name}: free ${kind} | SPUZL`,
    `${g.name}: play free online | SPUZL`,
  ];
  return tries.find((t) => t.length < 60) ?? `${g.name} | SPUZL`;
}

/** Search description under 155 characters: the definition when it fits, else a shorter one from the card copy. */
export function gameDescription(g: GameMeta): string {
  const kind = kindOf(g);
  const own = GAME_SEO[g.id]?.description;
  const tries = [
    ...(own ? [own] : []),
    `${definitionOf(g)} Free in your browser.`,
    definitionOf(g),
    `${g.name} is a free online ${kind}. ${g.rule} Play in your browser, no download.`,
    `${g.name} is a free online ${kind}. ${g.rule}`,
    `${g.name} is a free online ${kind}: ${g.blurb.toLowerCase()}. Play in your browser, no download.`,
    `${capitalise(kind)}: ${g.blurb}. Free on SPUZL.`,
  ];
  return tries.find((d) => d.length < 155) ?? tries.at(-1)!.slice(0, 154);
}

/** The counts public pages show: the games that are On now, the worlds that hold them and those worlds' names. */
export function publicCounts(s: GameSwitch = LIVE_ONLY): { games: number; worlds: number; names: string } {
  const worlds = playerWorlds(s);
  return { games: publicGames(s).length, worlds: worlds.length, names: worldNamesOf(worlds.map((w) => w.name)) };
}
