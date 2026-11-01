import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULTS, mergeSettings, type GameSettings } from "./schema";

let cache: { at: number; value: GameSettings } | null = null;
// 30 s in production; no cache in development and tests (SETTINGS_CACHE_MS overrides), so a change applies at once.
const TTL_MS = Number(process.env.SETTINGS_CACHE_MS ?? (process.env.NODE_ENV === "production" ? 30_000 : 0));

/** Current game settings (stored values over defaults), cached for 30 s per server instance. */
export async function getGameSettings(): Promise<GameSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const { data, error } = await supabaseAdmin().from("game_settings").select("key, value");
    if (error) throw error;
    cache = { at: Date.now(), value: mergeSettings(data ?? []) };
  } catch {
    // Table missing (rolled back) or database hiccup: play continues on defaults.
    cache = { at: Date.now(), value: { ...DEFAULTS } };
  }
  return cache.value;
}

/** Drops the cache after an admin change so this instance serves the new value at once. */
export function invalidateGameSettings() {
  cache = null;
}
