import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrawWord } from "./content";
import { familyListFrom, type FamilySource, type FamilyWordRow } from "./family-list";

/** How long a server instance keeps the word list before reading the table again. */
const TTL_MS = 30_000;
let cache: { at: number; words: readonly DrawWord[]; source: FamilySource } | null = null;

export const FAMILY_WORD_COLS = "id, word, alt, sort, retired_at, retired_by, created_by, updated_by, created_at, updated_at";

/**
 * The Family Draw words a 16+ round deals from (round 3, item 11): the active rows of public.family_draw_words, read
 * at runtime (30 s cache per server instance), or the code list while the table holds too few (./family-list.ts).
 */
export async function familyWords(db: SupabaseClient): Promise<{ words: readonly DrawWord[]; source: FamilySource }> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const { data, error } = await db.from("family_draw_words").select("id, word, alt, sort, retired_at").is("retired_at", null);
  const list = familyListFrom(error ? null : ((data ?? []) as FamilyWordRow[]));
  cache = { at: Date.now(), ...list };
  return list;
}

/** After an admin write, this instance reads the table again on the next round (others within 30 s). */
export function forgetFamilyWords() {
  cache = null;
}
