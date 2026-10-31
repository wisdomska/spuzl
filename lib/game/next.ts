import { GAMES, GAME_BY_ID, LAUNCH_IDS, WORLD_BY_ID } from "@/lib/catalog";

/**
 * The game "Next" leads to after `current`: the next uncleared, ready Daily on the Home path (the same order
 * Home's Play card follows), else the next game in the same world. Never the game just played.
 */
export function nextInPath(current: string, cleared: Record<string, unknown>, ready: (id: string) => boolean): string | null {
  const start = Math.max(0, LAUNCH_IDS.indexOf(current) + 1);
  const ordered = [...LAUNCH_IDS.slice(start), ...LAUNCH_IDS.slice(0, start)];
  const path = ordered.find((id) => id !== current && cleared[id] === undefined && ready(id));
  if (path) return path;
  const meta = GAME_BY_ID[current];
  if (!meta) return null;
  const world = GAMES.filter((g) => g.world === meta.world);
  const i = world.findIndex((g) => g.id === current);
  return world.length > 1 ? world[(i + 1) % world.length].id : null;
}

/** "Next in Logic Lab: Dusk" */
export function nextLabel(id: string): string {
  const g = GAME_BY_ID[id];
  return `Next in ${WORLD_BY_ID[g.world].name}: ${g.name}`;
}
