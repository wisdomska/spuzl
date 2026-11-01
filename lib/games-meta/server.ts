import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_META, isTag, type GameMetaRow } from "./index";

/** Stored overrides (games.typical_sec, games.tags) over the code defaults. */
export function mergeMeta(rows: { id: string; typical_sec: number | null; tags: string[] | null }[]): Record<string, GameMetaRow> {
  const out: Record<string, GameMetaRow> = Object.fromEntries(Object.entries(DEFAULT_META).map(([k, v]) => [k, { ...v }]));
  for (const r of rows) {
    if (!out[r.id]) continue;
    if (typeof r.typical_sec === "number") out[r.id].typicalSec = r.typical_sec;
    if (Array.isArray(r.tags)) out[r.id].tags = r.tags.filter(isTag);
  }
  return out;
}

export async function loadGamesMeta(): Promise<Record<string, GameMetaRow>> {
  const { data, error } = await supabaseAdmin().from("games").select("id, typical_sec, tags");
  if (error) return DEFAULT_META;
  return mergeMeta(data ?? []);
}
