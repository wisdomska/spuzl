import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GAME_BY_ID, type GameMeta } from "@/lib/catalog";
import { DEFAULT_META, gameCopy, isTag, validateCopyLine, type GameMetaRow } from "./index";

export type GameMetaDbRow = {
  id: string;
  typical_sec: number | null;
  tags: string[] | null;
  rule?: string | null;
  blurb?: string | null;
  typical_score?: number | null;
};

/** The columns every reader of the Library metadata selects. */
export const META_COLS = "id, typical_sec, tags, rule, blurb, typical_score";
const META_COLS_R2 = "id, typical_sec, tags, rule, blurb";

/**
 * Stored overrides (games.typical_sec, tags, rule, blurb) over the code defaults. The copy overrides are kept only
 * when they are still one valid line (the database checks too); otherwise the catalog's copy shows.
 */
export function mergeMeta(rows: GameMetaDbRow[]): Record<string, GameMetaRow> {
  const out: Record<string, GameMetaRow> = Object.fromEntries(Object.entries(DEFAULT_META).map(([k, v]) => [k, { ...v }]));
  for (const r of rows) {
    if (!out[r.id]) continue;
    if (typeof r.typical_sec === "number") out[r.id].typicalSec = r.typical_sec;
    if (Array.isArray(r.tags)) out[r.id].tags = r.tags.filter(isTag);
    if (r.rule != null && validateCopyLine(r.rule, "rule") === null) out[r.id].rule = r.rule;
    if (r.blurb != null && validateCopyLine(r.blurb, "blurb") === null) out[r.id].blurb = r.blurb;
    if (typeof r.typical_score === "number" && GAME_BY_ID[r.id]?.scoring === "score") out[r.id].typicalScore = r.typical_score;
  }
  return out;
}

/**
 * Every game's stored overrides. Before 20261210900101 (typical_score) or 20261202000101 (the rule and blurb
 * columns) is applied, falls back to the columns that exist, so a deploy that runs ahead of the migration keeps the
 * existing overrides.
 */
export async function selectMetaRows(db: SupabaseClient): Promise<GameMetaDbRow[]> {
  const full = await db.from("games").select(META_COLS);
  if (!full.error) return (full.data ?? []) as GameMetaDbRow[];
  const r2 = await db.from("games").select(META_COLS_R2);
  if (!r2.error) return (r2.data ?? []) as GameMetaDbRow[];
  const old = await db.from("games").select("id, typical_sec, tags");
  if (old.error) throw old.error;
  return (old.data ?? []) as GameMetaDbRow[];
}

// 30 s per server instance in production (like game settings); none in development and tests.
let cache: { at: number; value: Record<string, GameMetaRow> } | null = null;
const TTL_MS = Number(process.env.SETTINGS_CACHE_MS ?? (process.env.NODE_ENV === "production" ? 30_000 : 0));

/** `fresh` skips this instance's cache (static pages rebuilt after an admin change, R4-10). */
export async function loadGamesMeta(opts: { fresh?: boolean } = {}): Promise<Record<string, GameMetaRow>> {
  if (!opts.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const value = mergeMeta(await selectMetaRows(supabaseAdmin()));
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_META;
  }
}

/** Drops the cache after an admin edit so this instance serves the new durations, tags and copy at once. */
export function invalidateGamesMeta() {
  cache = null;
}

/**
 * R4-10: the game with the admin's rule and card copy (Library page) in place of the catalog's, for copy built on the
 * server (the practice coaching hint, How to play, the Play page description, the public game pages and llms.txt).
 */
export function withCopy<T extends Pick<GameMeta, "id" | "rule" | "blurb">>(g: T, meta: Record<string, GameMetaRow | undefined>): T {
  const c = gameCopy(g, meta);
  return c.rule === g.rule && c.blurb === g.blurb ? g : { ...g, ...c };
}

/**
 * Loads the Library metadata once and returns a mapper that puts the admin's copy on any game. For static pages
 * (rebuilt at most hourly, or on their next visit after a copy change): it reads the database, not this instance's
 * 30 s cache, so a rebuild on another server never bakes in the old copy for an hour.
 */
export async function servedCopy(): Promise<<T extends Pick<GameMeta, "id" | "rule" | "blurb">>(g: T) => T> {
  const meta = await loadGamesMeta({ fresh: true });
  return (g) => withCopy(g, meta);
}
