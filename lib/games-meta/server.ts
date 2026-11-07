import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_META, isTag, validateCopyLine, type GameMetaRow } from "./index";

export type GameMetaDbRow = {
  id: string;
  typical_sec: number | null;
  tags: string[] | null;
  rule?: string | null;
  blurb?: string | null;
};

/** The columns every reader of the Library metadata selects. */
export const META_COLS = "id, typical_sec, tags, rule, blurb";

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
  }
  return out;
}

/**
 * Every game's stored overrides. Before 20261202000101 (the rule and blurb columns) is applied, falls back to the
 * duration and tags, so a deploy that runs ahead of the migration keeps the existing overrides.
 */
export async function selectMetaRows(db: SupabaseClient): Promise<GameMetaDbRow[]> {
  const full = await db.from("games").select(META_COLS);
  if (!full.error) return (full.data ?? []) as GameMetaDbRow[];
  const old = await db.from("games").select("id, typical_sec, tags");
  if (old.error) throw old.error;
  return (old.data ?? []) as GameMetaDbRow[];
}

export async function loadGamesMeta(): Promise<Record<string, GameMetaRow>> {
  try {
    return mergeMeta(await selectMetaRows(supabaseAdmin()));
  } catch {
    return DEFAULT_META;
  }
}
