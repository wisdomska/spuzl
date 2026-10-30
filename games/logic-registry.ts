/**
 * Game logic modules by id, loaded on demand. Server-safe (no React). Each entry is code-split.
 * Add a line here when a game's logic.ts lands; `hasLogic` lets the UI show games still in the build queue.
 */
import type { GameLogic } from "./types";

type Loader = () => Promise<{ default: GameLogic<any, any, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const LOGIC: Record<string, Loader> = {
  crownfall: () => import("./crownfall/logic"),
  dusk: () => import("./dusk/logic"),
  sixer: () => import("./sixer/logic"),
  nine: () => import("./nine/logic"),
  pixl: () => import("./pixl/logic"),
  blackout: () => import("./blackout/logic"),
  tripwire: () => import("./tripwire/logic"),
  chess: () => import("./chess/logic"),
  draughts: () => import("./draughts/logic"),
  oware: () => import("./oware/logic"),
  fourup: () => import("./fourup/logic"),
  flip: () => import("./flip/logic"),
  ludo: () => import("./ludo/logic"),
  weave: () => import("./weave/logic"),
  flowline: () => import("./flowline/logic"),
  isles: () => import("./isles/logic"),
  pairup: () => import("./pairup/logic"),
  lost: () => import("./lost/logic"),
  hunch: () => import("./hunch/logic"),
  echo: () => import("./echo/logic"),
  twins: () => import("./twins/logic"),
  flinch: () => import("./flinch/logic"),
  quickfire: () => import("./quickfire/logic"),
  flagged: () => import("./flagged/logic"),
  pinned: () => import("./pinned/logic"),
  quilt: () => import("./quilt/logic"),
  deadon: () => import("./deadon/logic"),
  snug: () => import("./snug/logic"),
  shuffle: () => import("./shuffle/logic"),
  reflect: () => import("./reflect/logic"),
  squint: () => import("./squint/logic"),
  merge: () => import("./merge/logic"),
  sums: () => import("./sums/logic"),
  equal: () => import("./equal/logic"),
  gotcha: () => import("./gotcha/logic"),
  dash: () => import("./dash/logic"),
  flipside: () => import("./flipside/logic"),
  ricochet: () => import("./ricochet/logic"),
  stacked: () => import("./stacked/logic"),
  wobble: () => import("./wobble/logic"),
  grapple: () => import("./grapple/logic"),
  ghosted: () => import("./ghosted/logic"),
  slip: () => import("./slip/logic"),
  gauntlet: () => import("./gauntlet/logic"),
};

export function hasLogic(id: string) {
  return id in LOGIC;
}

export async function loadLogic(id: string): Promise<GameLogic<unknown, unknown, unknown>> {
  const l = LOGIC[id];
  if (!l) throw new Error(`no logic for game ${id}`);
  return (await l()).default as GameLogic<unknown, unknown, unknown>;
}
