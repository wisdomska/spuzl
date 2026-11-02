import { GAME_BY_ID, isLiveWorld } from "@/lib/catalog";

/** Quest kinds whose progress is the number of distinct live worlds cleared in the quest's period. */
export const WORLD_COUNT_KINDS = ["worlds_today", "worlds_week"];

/** Distinct live worlds among the given cleared game ids, capped at the goal. Unknown games are ignored. */
export function worldsProgress(gameIds: Iterable<string>, goal: number): number {
  const worlds = new Set<string>();
  for (const id of gameIds) {
    const world = Object.hasOwn(GAME_BY_ID, id) ? GAME_BY_ID[id].world : null;
    if (isLiveWorld(world)) worlds.add(world!);
  }
  return Math.min(goal, worlds.size);
}
