/**
 * Family Draw word packs for the admin Content page (R2-P5): the 16+ Draw It word list
 * (lib/party-adult/family.ts FAMILY_DRAW_WORDS) as JSON, and a check of a pasted pack against the same rules the
 * list's unit test holds: preset words only, letters and spaces, short, unique, and every name passes the party text
 * filter with its word list on. The list lives in code, so a checked pack is handed to a developer to ship; the
 * panel shows what it would add and drop. Pure: client, tests and any later import route share it.
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

function checkWord(raw: unknown): ItemCheck<DrawWord> {
  const r = WordSchema.safeParse(typeof raw === "string" ? { word: raw } : raw);
  if (r.success) return { ok: true, value: r.data.alt?.length ? { word: r.data.word, alt: r.data.alt } : { word: r.data.word } };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`) };
}

/** Reads a pack (or a bare list of words or { word, alt } rows) back; every problem listed, nothing passes unless all do. */
export function parseDrawPack(text: string): PackResult<DrawWord> {
  return parseListPack(text, { kind: DRAW_KIND, key: "words", noun: "Word", max: MAX_DRAW_PACK, check: checkWord, unique: (w) => w.word });
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
