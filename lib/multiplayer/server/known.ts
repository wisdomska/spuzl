import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRaceGame } from "../games";

/** Race games each player has cleared at least once (any mode); with `only`, just those games are looked up. */
export async function knownGames(admin: SupabaseClient, playerIds: string[], only?: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map(playerIds.map((p) => [p, new Set<string>()]));
  if (!playerIds.length) return out;
  let q = admin.from("attempts").select("player_id, game_id").in("player_id", playerIds).eq("status", "cleared");
  if (only) q = q.in("game_id", only);
  const { data } = await q.limit(2000);
  for (const r of data ?? []) if (isRaceGame(r.game_id)) out.get(r.player_id)?.add(r.game_id);
  return out;
}
