/**
 * Level ladders ("Levels" mode beside free play). Client-safe: no level data, only the rules.
 *
 * Two kinds of ladder:
 * - pool: Rage Ridge course games (Gotcha, Dash, Gauntlet). Level n is the n-th room of the game's
 *   hand-ordered pool (games/<id>/levels.ts LEVELS), played as a one-room course. Finite.
 * - seeded: generated puzzle games. Level n is `generate(createRng("level:<game>:<n>"), levelDifficulty(n))`,
 *   so it is the same board for everyone, harder (and bigger, where the game sizes boards by difficulty)
 *   as n grows. Endless.
 *
 * Levels unlock one at a time: a player may start any level up to one past their highest verified clear,
 * and replay any cleared level. The server enforces this (lib/game/service.ts); the seed never leaves it.
 */
import type { Difficulty } from "@/games/types";

/** Rooms in each pool ladder. A unit test keeps these equal to games/<id>/levels.ts LEVELS.length. */
export const POOL_LADDERS = { gotcha: 64, dash: 64, gauntlet: 66 } as const;

/** Generated puzzle games with an endless seeded ladder. */
export const SEEDED_LADDERS = ["crownfall", "dusk", "sixer", "nine", "weave", "flowline", "pairup", "lost", "trotro"] as const;

export type LadderGame = keyof typeof POOL_LADDERS | (typeof SEEDED_LADDERS)[number];

/** Highest level number a request may name (seeded ladders are endless; this only bounds the input). */
export const MAX_LEVEL = 9999;

export function isLadderGame(id: string): id is LadderGame {
  return id in POOL_LADDERS || (SEEDED_LADDERS as readonly string[]).includes(id);
}

/** Number of levels in a game's ladder, or null when it is endless. */
export function levelCount(id: string): number | null {
  return id in POOL_LADDERS ? POOL_LADDERS[id as keyof typeof POOL_LADDERS] : null;
}

/**
 * Difficulty for level n of a seeded ladder: five easy levels to learn on, then medium, hard and expert bands,
 * and mega from level 36 on.
 */
export const LEVEL_BANDS: { from: number; difficulty: Difficulty }[] = [
  { from: 1, difficulty: "easy" },
  { from: 6, difficulty: "medium" },
  { from: 13, difficulty: "hard" },
  { from: 23, difficulty: "expert" },
  { from: 36, difficulty: "mega" },
];

export function levelDifficulty(n: number): Difficulty {
  let d: Difficulty = "easy";
  for (const b of LEVEL_BANDS) if (n >= b.from) d = b.difficulty;
  return d;
}

/** The deterministic seed of level n (server only: never sent to a client). */
export const levelSeed = (game: string, n: number) => `level:${game}:${n}`;

/** True when `n` is a level number the ladder has. */
export function isLevel(game: string, n: number): boolean {
  const count = levelCount(game);
  return Number.isInteger(n) && n >= 1 && n <= (count ?? MAX_LEVEL);
}

/** Unlock rule: any level up to one past the highest cleared (`top`, 0 when none) is open; cleared ones replay. */
export function levelOpen(game: string, n: number, top: number): boolean {
  return isLevel(game, n) && n <= top + 1;
}

/** The level a player should play next: one past their highest clear, or the last one when the ladder is done. */
export function nextLevel(game: string, top: number): number {
  const count = levelCount(game);
  return count === null ? top + 1 : Math.min(count, top + 1);
}

/** True once every level of a finite ladder is cleared. */
export function ladderDone(game: string, top: number): boolean {
  const count = levelCount(game);
  return count !== null && top >= count;
}
