import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/server";
import { MIN_FAMILY_WORDS } from "@/lib/party-adult/family-list";
import { FAMILY_WORD_COLS } from "@/lib/party-adult/family-words";

/** A Family Draw word as the admin list shows it (public.family_draw_words, round 3 item 11). */
export interface FamilyWordAdminRow {
  id: string;
  word: string;
  alt: string[];
  sort: number;
  retired_at: string | null;
  retired_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Every stored word, active and retired, in list order. */
export async function allFamilyWords(db: SupabaseClient): Promise<FamilyWordAdminRow[]> {
  const { data, error } = await db.from("family_draw_words").select(FAMILY_WORD_COLS).order("sort").order("word");
  if (error) throw error;
  return (data ?? []) as FamilyWordAdminRow[];
}

/** Refuses a change that would leave fewer than MIN_FAMILY_WORDS active words (a round needs a real pool). */
export function keepEnough(activeAfter: number) {
  if (activeAfter < MIN_FAMILY_WORDS)
    throw new ApiError(409, "too_few_words", `Keep at least ${MIN_FAMILY_WORDS} active words, so rounds don't repeat.`);
}

/** A unique-word clash from Postgres as a friendly 409. */
export function wordClash(e: { code?: string } | null): never | void {
  if (e?.code === "23505") throw new ApiError(409, "word_taken", "That word is already on the list.");
  if (e) throw e;
}
