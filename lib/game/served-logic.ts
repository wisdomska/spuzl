import "server-only";
import { loadLogic } from "@/games/logic-registry";
import type { GameLogic } from "@/games/types";
import { syncContentReview } from "@/lib/admin/content-review-server";

/**
 * A game's logic for building boards players get: for content games, the reviewed state is loaded first (round 3,
 * item 12), so the picker never deals a retired entry and deals edited ones. Every server path that builds a board
 * for players (attempts, Dailies, Daily Five, duels, async races, guided play) loads logic through here.
 */
export async function loadServedLogic(id: string): Promise<GameLogic<unknown, unknown, unknown>> {
  await syncContentReview(id);
  return loadLogic(id);
}
