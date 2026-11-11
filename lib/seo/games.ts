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
import { isRaceGame } from "@/lib/multiplayer/games";
import { isBayGame } from "@/lib/multiplayer/bay";
import { CONTROLS, SCORING, definitionOf, gamesCopy as T, kindOf, worldNamesOf, type QA } from "@/lib/copy/seo";

export type GameMode = "free" | "levels" | "duel" | "party" | "bay" | "bot";

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

export function gameModes(g: GameMeta, s: GameSwitch = LIVE_ONLY): GameMode[] {
  const m: GameMode[] = ["free"];
  if (isLadderGame(g.id)) m.push("levels");
  // A game the admin keeps out of Duels and Parties (Games page) doesn't claim them.
  if (isRaceGame(g.id) && versusAllowed(g.id, s)) m.push("duel", "party");
  if (isBayGame(g.id)) m.push("bay");
  if (g.botPlay) m.push("bot");
  return m;
}

export function gameFacts(g: GameMeta, lab: GameSwitch = LIVE_ONLY): GameFacts {
  const typicalSec = defaultMetaFor(g.id).typicalSec;
  const label = durationLabel(typicalSec);
  const levels = isLadderGame(g.id) ? levelCount(g.id) : undefined;
  const modes = gameModes(g, lab);
  const modeLines = modes.map((m) =>
    m === "free" ? T.modes.free(g) : m === "levels" ? (levels ? T.modes.levelsPool(levels) : T.modes.levelsEndless) : T.modes[m],
  );
  const faq: QA[] = [T.faq.free(g), T.faq.time(g, label), T.faq.account(g)];
  if (levels) faq.push(T.faq.levelsPool(g, levels));
  else if (levels === null) faq.push(T.faq.levelsEndless(g));
  if (modes.includes("duel")) faq.push(T.faq.friendsRace(g));
  else if (modes.includes("bay")) faq.push(T.faq.friendsBay(g));
  if (faq.length < 5) faq.push(T.faq.phone(g));
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
    controls: CONTROLS[g.engine],
    scoring: SCORING[g.scoring],
    faq: faq.slice(0, 5),
    related: publicGamesInWorld(g.world, lab).filter((x) => x.id !== g.id),
  };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "<Game>: free online <kind> | SPUZL", kept under 60 characters (drops "online", then the kind, if needed). */
export function gameTitle(g: GameMeta): string {
  const kind = kindOf(g);
  const tries = [`${g.name}: free online ${kind} | SPUZL`, `${g.name}: free ${kind} | SPUZL`, `${g.name}: play free online | SPUZL`];
  return tries.find((t) => t.length < 60) ?? `${g.name} | SPUZL`;
}

/** Search description under 155 characters: the definition when it fits, else a shorter one from the card copy. */
export function gameDescription(g: GameMeta): string {
  const kind = kindOf(g);
  const tries = [
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
