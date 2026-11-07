/**
 * Two Truths and a Lie round packs for the admin Content page (R2-P5): export the listed rounds as JSON, import a
 * pack as drafts for the usual two-person review. Each round is checked with the editor's schema
 * (lib/admin/content-schemas.ts `twotruths`). Pure: client, server and the round-trip test share it.
 */
import { validatePayload } from "@/lib/admin/content-schemas";
import type { TruthsRound } from "@/games/twotruths/content";
import { listPackToJson, parseListPack, type ItemCheck, type PackResult } from "./list-pack";

export const TRUTHS_KIND = "twotruths";
export const MAX_TRUTHS_PACK = 200;

export function truthsPackToJson(rounds: readonly TruthsRound[]): string {
  return listPackToJson(TRUTHS_KIND, "rounds", rounds);
}

function checkRound(raw: unknown): ItemCheck<TruthsRound> {
  const v = validatePayload("twotruths", raw);
  if (v.success) return { ok: true, value: v.data as TruthsRound };
  return { ok: false, errors: v.issues.map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`) };
}

/** Reads a pack (or a bare list of rounds) back; every problem listed, nothing passes unless all do. */
export function parseTruthsPack(text: string): PackResult<TruthsRound> {
  return parseListPack(text, {
    kind: TRUTHS_KIND,
    key: "rounds",
    noun: "Round",
    max: MAX_TRUTHS_PACK,
    check: checkRound,
    unique: (r) => r.id,
  });
}
