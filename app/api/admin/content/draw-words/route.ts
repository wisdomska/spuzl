import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { checkDrawWord } from "@/lib/admin/draw-pack";
import { allFamilyWords, wordClash } from "@/lib/admin/draw-words";
import { familyListFrom, MIN_FAMILY_WORDS } from "@/lib/party-adult/family-list";
import { FAMILY_WORD_COLS, forgetFamilyWords } from "@/lib/party-adult/family-words";

/**
 * GET /api/admin/content/draw-words: every Family Draw word (round 3, item 11), active and retired, in list order,
 * plus `source` ("db" while the table can fill a round, "code" while rounds fall back to the code list), the active
 * count and the minimum the list keeps.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin("content.read");
  const rows = await allFamilyWords(ctx.db);
  const active = rows.filter((r) => !r.retired_at).length;
  return ok({ rows, active, min: MIN_FAMILY_WORDS, source: familyListFrom(rows).source });
});

const Add = z.object({ word: z.unknown(), alt: z.unknown().optional() });

/**
 * POST /api/admin/content/draw-words: adds one word ({ word, alt }) to the end of the list. The same check as a pack
 * (lower-case letters and single spaces, 2 to 30 characters, at most six other names, every name past the party text
 * filter with its word list on); 422 with the problems, 409 word_taken for a word already stored. Audited.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const input = await body(req, Add);
  const c = checkDrawWord(input.alt === undefined ? { word: input.word } : input);
  if (!c.ok) return Response.json({ error: "invalid_word", message: c.errors.join(" "), errors: c.errors }, { status: 422 });
  const { data: last } = await ctx.db.from("family_draw_words").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await ctx.db
    .from("family_draw_words")
    .insert({ word: c.value.word, alt: c.value.alt ?? [], sort: (last?.sort ?? 0) + 1, created_by: ctx.user.id, updated_by: ctx.user.id })
    .select(FAMILY_WORD_COLS)
    .single();
  wordClash(error);
  if (!data) throw new ApiError(500, "add_failed");
  forgetFamilyWords();
  await audit(ctx, "drawword.add", `drawword:${data.id}`, { word: c.value.word, alt: c.value.alt ?? [] });
  return ok(data);
});
