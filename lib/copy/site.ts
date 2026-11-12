import { GAME_COUNT, WORLD_COUNT } from "@/lib/catalog";

/**
 * Site-wide metadata and counts (root layout, web app manifest, How to play). The numbers come from the
 * catalog's live games and worlds, so retiring or adding a game never leaves a stale count behind.
 */
export const siteCopy = {
  title: `SPUZL · ${GAME_COUNT} games, one Grid`,
  description: `Puzzles, skill games and classic board games across ${WORLD_COUNT} worlds. Play anytime, duel your friends, keep your streak alive.`,
  howToPlayLede: `${GAME_COUNT} games in ${WORLD_COUNT} worlds. Every rule at a glance.`,
  /** The same, counting the games that are On (How to play follows the Games page state). */
  howToPlayLedeFor: (games: number, worlds: number) => `${games} games in ${worlds} worlds. Every rule at a glance.`,
} as const;
