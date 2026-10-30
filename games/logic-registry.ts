/**
 * Game logic modules by id, loaded on demand. Server-safe (no React). Each entry is code-split.
 * Add a line here when a game's logic.ts lands; `hasLogic` lets the UI show games still in the build queue.
 */
import type { GameLogic } from "./types";

type Loader = () => Promise<{ default: GameLogic<any, any, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const LOGIC: Record<string, Loader> = {
  crownfall: () => import("./crownfall/logic"),
  coil: () => import("./coil/logic"),
  quads: () => import("./quads/logic"),
  rungs: () => import("./rungs/logic"),
};

export function hasLogic(id: string) {
  return id in LOGIC;
}

export async function loadLogic(id: string): Promise<GameLogic<unknown, unknown, unknown>> {
  const l = LOGIC[id];
  if (!l) throw new Error(`no logic for game ${id}`);
  return (await l()).default as GameLogic<unknown, unknown, unknown>;
}
