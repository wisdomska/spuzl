import "server-only";
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTENT_SCHEMAS } from "@/lib/admin/content-schemas";
import type { QuadsEntry } from "@/games/quads/content";

/**
 * R4-15: approved Quads items an editor put in the free-play pool (content_items.pooled_at), dealt in free play mixed
 * with games/quads/content.ts. A pooled board's server seed names its item (`qpool:<item id>:<uuid>`), so the board
 * is rebuilt from the same item at every guess and at finish, even if the pool changes meanwhile. The groups never
 * leave the server: players get the 16 words, as for any Quads board.
 */
export const POOL_SEED = "qpool:";

// The pool's ids, 30 s per server instance in production (like the content review), none in tests.
let cache: { at: number; ids: string[] } | null = null;
const TTL_MS = Number(process.env.SETTINGS_CACHE_MS ?? (process.env.NODE_ENV === "production" ? 30_000 : 0));

export async function quadsPoolIds(db: SupabaseClient): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids;
  const { data, error } = await db
    .from("content_items")
    .select("id")
    .eq("game_id", "quads")
    .eq("source", "editor")
    .in("status", ["approved", "scheduled"])
    .not("pooled_at", "is", null)
    .order("pooled_at")
    .limit(2000);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id as string);
  cache = { at: Date.now(), ids };
  return ids;
}

/** After an admin adds or removes an item: this instance reads the pool again on its next board. */
export function forgetQuadsPool() {
  cache = null;
}

/**
 * Picks the item for a new free-play board: each of the `codeCount` built-in entries and each pooled item is equally
 * likely. Null means a built-in entry (the usual seeded board). `pick` is injectable for tests.
 */
export function pickPooled(ids: readonly string[], codeCount: number, pick: (n: number) => number = randomInt): string | null {
  if (!ids.length) return null;
  const r = pick(ids.length + Math.max(0, codeCount));
  return r < ids.length ? ids[r] : null;
}

/** The item id of a pooled seed, or null for any other seed. */
export function pooledItemOf(seed: string): string | null {
  if (!seed.startsWith(POOL_SEED)) return null;
  const id = seed.slice(POOL_SEED.length).split(":")[0];
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * The entry behind a pooled seed, read by id whatever its pool state now (a board in play keeps its item even if
 * the item leaves the pool), and checked against the Quads format. Null when it is gone or no longer valid.
 */
export async function pooledEntry(db: SupabaseClient, id: string): Promise<QuadsEntry | null> {
  const { data } = await db.from("content_items").select("payload, game_id, source").eq("id", id).maybeSingle();
  if (!data || data.game_id !== "quads" || data.source !== "editor") return null;
  const ok = CONTENT_SCHEMAS.quads.safeParse(data.payload);
  return ok.success ? (ok.data as QuadsEntry) : null;
}
