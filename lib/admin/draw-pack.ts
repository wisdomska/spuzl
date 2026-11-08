/**
 * Family Draw word packs for the admin Content page (R2-P5): the 16+ Draw It word list as JSON, and a check of a
 * pasted pack against the same rules the list's unit test holds: preset words only, letters and spaces, short,
 * unique, and every name passes the party text filter with its word list on (the blocklist). Since round 3 (item 11)
 * the list lives in public.family_draw_words: the panel shows what a pack adds and drops, and the import route
 * (app/api/admin/content/draw-words/import) saves it after the same check. Pure: client, tests and routes share it.
 */
import { z } from "zod";
import type { DrawWord } from "@/lib/party-adult/content";
import { normaliseWord } from "@/lib/party-adult/content";
import { partyTextProblem } from "@/lib/party-adult/filter";
import { listPackToJson, parseListPack, type ItemCheck, type PackResult } from "./list-pack";

export const DRAW_KIND = "drawit";
export const MAX_DRAW_PACK = 300;

const name = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "At least 2 letters")
  .max(30, "At most 30 characters")
  .regex(/^[a-z][a-z ]*[a-z]$/, "Letters and single spaces only")
  .refine((s) => !s.includes("  "), "Letters and single spaces only")
  .refine((s) => partyTextProblem(s, "guess", { words: true }) === null, "Not a family-safe word (the party text filter refuses it)");

const WordSchema = z
  .strictObject({ word: name, alt: z.array(name).max(6).optional() })
  .refine((w) => !(w.alt ?? []).some((a) => normaliseWord(a) === normaliseWord(w.word)), {
    message: "An other name repeats the word",
    path: ["alt"],
  });

export function drawPackToJson(words: readonly DrawWord[]): string {
  return listPackToJson(
    DRAW_KIND,
    "words",
    words.map((w) => (w.alt?.length ? { word: w.word, alt: [...w.alt] } : { word: w.word })),
  );
}

/** One word (a bare string, or { word, alt }) checked and tidied: the rule for the pack, the add form and the API. */
export function checkDrawWord(raw: unknown): ItemCheck<DrawWord> {
  const r = WordSchema.safeParse(typeof raw === "string" ? { word: raw } : raw);
  if (r.success) return { ok: true, value: r.data.alt?.length ? { word: r.data.word, alt: r.data.alt } : { word: r.data.word } };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`) };
}

/** Reads a pack (or a bare list of words or { word, alt } rows) back; every problem listed, nothing passes unless all do. */
export function parseDrawPack(text: string): PackResult<DrawWord> {
  return parseListPack(text, {
    kind: DRAW_KIND,
    key: "words",
    noun: "Word",
    max: MAX_DRAW_PACK,
    check: checkDrawWord,
    unique: (w) => w.word,
  });
}

/** What a checked pack changes against the current list: words it adds and words it drops. */
export function drawPackDiff(current: readonly DrawWord[], next: readonly DrawWord[]) {
  const have = new Set(current.map((w) => w.word));
  const want = new Set(next.map((w) => w.word));
  return {
    added: next.filter((w) => !have.has(w.word)).map((w) => w.word),
    dropped: current.filter((w) => !want.has(w.word)).map((w) => w.word),
  };
}

/** A stored word as the import plan reads it (public.family_draw_words). */
export interface StoredDrawWord {
  id: string;
  word: string;
  alt: string[] | null;
  retired_at: string | null;
}

export interface DrawImportPlan {
  /** new words, in pack order */
  add: DrawWord[];
  /** stored words whose other names change, or that come back from retired */
  update: { id: string; word: string; alt: string[]; restore: boolean }[];
  /** active stored words the pack leaves out (only with `retireMissing`) */
  retire: { id: string; word: string }[];
}

const sameNames = (a: readonly string[] | null | undefined, b: readonly string[] | null | undefined) =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

/**
 * What importing a checked pack does to the stored list (round 3, item 11): adds the new words, updates the other
 * names of words already stored (bringing retired ones back), and with `retireMissing` retires the active words the
 * pack leaves out. Nothing is ever deleted, so every change can be undone from the list.
 */
export function planDrawImport(stored: readonly StoredDrawWord[], pack: readonly DrawWord[], retireMissing = false): DrawImportPlan {
  const byWord = new Map(stored.map((r) => [r.word, r]));
  const inPack = new Set(pack.map((w) => w.word));
  const add: DrawWord[] = [];
  const update: DrawImportPlan["update"] = [];
  for (const w of pack) {
    const have = byWord.get(w.word);
    if (!have) add.push(w);
    else if (have.retired_at || !sameNames(have.alt, w.alt))
      update.push({ id: have.id, word: w.word, alt: [...(w.alt ?? [])], restore: !!have.retired_at });
  }
  const retire = retireMissing ? stored.filter((r) => !r.retired_at && !inPack.has(r.word)).map((r) => ({ id: r.id, word: r.word })) : [];
  return { add, update, retire };
}

/** Active words left after a plan runs. */
export const activeAfter = (stored: readonly StoredDrawWord[], plan: DrawImportPlan) =>
  stored.filter((r) => !r.retired_at).length + plan.add.length + plan.update.filter((u) => u.restore).length - plan.retire.length;
