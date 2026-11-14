/**
 * Level ladders ("Levels" mode beside free play). Client-safe: no level data, only the rules.
 *
 * Two kinds of ladder:
 * - pool: the Arcade action games. Gotcha: level n is the n-th room of its ladder (games/gotcha/levels.generated.ts
 *   LADDER, curated for variety by scripts/rage-curate.ts), played as a one-room course. Dash: level n is a fixed
 *   seeded run with a distance to reach (games/dash/levels.ts). Finite.
 * - seeded: generated puzzle games. Level n is `generate(createRng(securedLevelSeed(game, n)), levelDifficulty(n))`
 *   (the `level:<game>:<n>` base keyed with a server secret, lib/game/level-seed.ts),
 *   so it is the same board for everyone. Difficulty climbs in waves with a boss every fifth level (and boards
 *   grow with it, where the game sizes boards by difficulty). Endless.
 *
 * Levels unlock one at a time: a player may start any level up to one past their highest verified clear,
 * and replay any cleared level. The server enforces this (lib/game/service.ts); the seed never leaves it.
 */
import type { Difficulty } from "@/games/types";

/** Rooms in each pool ladder. A unit test keeps these equal to games/<id>/levels.ts LEVELS.length. */
export const POOL_LADDERS = { gotcha: 60, dash: 30 } as const;

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

const TIERS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

/**
 * Base difficulty (index into easy..mega) for each block of five levels: one easy block to learn on, then two
 * medium, two hard, two expert, and from level 36 mega and expert blocks in turn (its last two entries repeat).
 */
export const LEVEL_BLOCKS = [0, 1, 1, 2, 2, 3, 3, 4, 3, 4];

/** How each level in a block of five moves from the base: the third is a breather, the fifth a boss. */
export const LEVEL_WAVE = [0, 0, -1, 0, 1];

/** True for every fifth level: a step harder (and on most games a bigger board) than the levels around it. */
export const isBossLevel = (n: number) => n >= 1 && n % 5 === 0;

/**
 * Difficulty for level n of a seeded ladder. It climbs in blocks of five and moves inside each block (base,
 * base, a breather, base, a boss), so neighbouring levels differ in size and feel instead of ten alike in a row.
 */
export function levelDifficulty(n: number): Difficulty {
  const i = Math.max(0, Math.floor(n) - 1);
  const b = Math.floor(i / 5);
  const L = LEVEL_BLOCKS.length;
  const block = LEVEL_BLOCKS[b < L ? b : L - 2 + ((b - L) % 2)];
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, block + LEVEL_WAVE[i % 5]))];
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
