import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRaceGame } from "../games";

/**
 * Race games each player knows: cleared at least once (any mode) or learned in a guided first play (any
 * device). With `only`, just those games are looked up.
 */
export async function knownGames(admin: SupabaseClient, playerIds: string[], only?: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map(playerIds.map((p) => [p, new Set<string>()]));
  if (!playerIds.length) return out;
  let cleared = admin.from("attempts").select("player_id, game_id").in("player_id", playerIds).eq("status", "cleared");
  let learned = admin.from("learned_games").select("player_id, game_id").in("player_id", playerIds);
  if (only) {
    cleared = cleared.in("game_id", only);
    learned = learned.in("game_id", only);
  }
  const [a, b] = await Promise.all([cleared.limit(2000), learned.limit(1000)]);
  for (const r of [...(a.data ?? []), ...(b.data ?? [])]) if (isRaceGame(r.game_id)) out.get(r.player_id)?.add(r.game_id);
  return out;
}
