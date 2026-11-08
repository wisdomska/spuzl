import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { checkDrawWord } from "@/lib/admin/draw-pack";
import { keepEnough, wordClash } from "@/lib/admin/draw-words";
import { FAMILY_WORD_COLS, forgetFamilyWords } from "@/lib/party-adult/family-words";

const Id = z.string().uuid();
const Patch = z
  .object({ word: z.unknown().optional(), alt: z.unknown().optional(), retired: z.boolean().optional() })
  .refine((p) => p.word !== undefined || p.alt !== undefined || p.retired !== undefined, "Nothing to change");

/**
 * PATCH /api/admin/content/draw-words/:id: edits a Family Draw word (round 3, item 11). `word` and `alt` go through
 * the same check as an added word; `retired: true` retires it (never dealt again, kept for the record; refused when
 * fewer than the minimum would stay active), `retired: false` brings it back. Each change is audited with the word
 * before and after.
 */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/content/draw-words/[id]">) => {
  const ctx = await requireAdmin("content.write");
  const id = Id.parse((await rc.params).id);
  const patch = await body(req, Patch);
  const { data: row } = await ctx.db.from("family_draw_words").select("id, word, alt, retired_at").eq("id", id).maybeSingle();
  if (!row) throw new ApiError(404, "word_not_found");
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now, updated_by: ctx.user.id };
  let action = "drawword.edit";

  if (patch.word !== undefined || patch.alt !== undefined) {
    const c = checkDrawWord({ word: patch.word ?? row.word, alt: patch.alt ?? row.alt ?? [] });
    if (!c.ok) return Response.json({ error: "invalid_word", message: c.errors.join(" "), errors: c.errors }, { status: 422 });
    Object.assign(update, { word: c.value.word, alt: c.value.alt ?? [] });
  }
  if (patch.retired === true && !row.retired_at) {
    const { count } = await ctx.db.from("family_draw_words").select("id", { count: "exact", head: true }).is("retired_at", null);
    keepEnough((count ?? 0) - 1);
    Object.assign(update, { retired_at: now, retired_by: ctx.user.id });
    action = "drawword.retire";
  } else if (patch.retired === false && row.retired_at) {
    Object.assign(update, { retired_at: null, retired_by: null });
    action = "drawword.restore";
  }

  const { data, error } = await ctx.db.from("family_draw_words").update(update).eq("id", id).select(FAMILY_WORD_COLS).single();
  wordClash(error);
  forgetFamilyWords();
  await audit(ctx, action, `drawword:${id}`, {
    before: { word: row.word, alt: row.alt ?? [] },
    ...(update.word !== undefined && { after: { word: update.word, alt: update.alt } }),
  });
  return ok(data);
});
