/**
 * Family Draw words from the database (round 3, item 11): public.family_draw_words rows to the list a 16+ round deals
 * from. Pure, so the server reader (./family-words.ts), the admin routes and the tests share it.
 *
 * The table is the source; the code list (FAMILY_DRAW_WORDS) is the fallback only while the table holds no active
 * words, or fewer than the four a round needs (a fresh database before the seed, or a table read that failed).
 */
import type { DrawWord } from "./content";
import { FAMILY_DRAW_WORDS, FAMILY_OPTIONS } from "./family";

export interface FamilyWordRow {
  id: string;
  word: string;
  alt: string[] | null;
  sort: number;
  retired_at: string | null;
}

/** The fewest active words the admin may leave: retiring (or importing with "retire the rest") stops here. */
export const MIN_FAMILY_WORDS = 12;

export type FamilySource = "db" | "code";

/** A row as the round setup uses it: the word and its other names (no empty alt list). */
export const rowToWord = (r: Pick<FamilyWordRow, "word" | "alt">): DrawWord =>
  r.alt?.length ? { word: r.word, alt: [...r.alt] } : { word: r.word };

/** Active rows in list order (sort, then word). */
export function activeRows<T extends Pick<FamilyWordRow, "word" | "sort" | "retired_at">>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.retired_at).sort((a, b) => a.sort - b.sort || a.word.localeCompare(b.word));
}

/** The words a round deals from: the table's active words, or the code list while the table can't fill a round. */
export function familyListFrom(rows: readonly FamilyWordRow[] | null): { words: readonly DrawWord[]; source: FamilySource } {
  const live = activeRows(rows ?? []);
  return live.length >= FAMILY_OPTIONS ? { words: live.map(rowToWord), source: "db" } : { words: FAMILY_DRAW_WORDS, source: "code" };
}
