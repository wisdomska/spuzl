import { GAME_COUNT, WORLD_COUNT } from "@/lib/catalog";

/**
 * Site-wide metadata and counts (root layout, web app manifest, How to play). The numbers come from the
 * catalog's live games and worlds, so retiring or adding a game never leaves a stale count behind.
 */
export const siteCopy = {
  title: `SPUZL · ${GAME_COUNT} games, one Grid`,
  description: `Puzzles, skill games and classic board games across ${WORLD_COUNT} worlds. Play anytime, duel your friends, keep your streak alive.`,
  howToPlayLede: `${GAME_COUNT} games in ${WORLD_COUNT} worlds. Every game is playable any time, as often as you like.`,
} as const;
