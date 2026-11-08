import { z } from "zod";
import { body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { activeAfter, parseDrawPack, planDrawImport } from "@/lib/admin/draw-pack";
import { allFamilyWords, keepEnough, wordClash } from "@/lib/admin/draw-words";
import { forgetFamilyWords } from "@/lib/party-adult/family-words";

const Import = z.object({ text: z.string().max(200_000), retireMissing: z.boolean().optional() });

/**
 * POST /api/admin/content/draw-words/import: a Family Draw words pack (lib/admin/draw-pack.ts) into the stored list
 * (round 3, item 11). All or nothing on the pack: any problem and nothing is saved (422 with every problem listed).
 * New words are added at the end; stored words take the pack's other names (retired ones come back); with
 * `retireMissing`, active words the pack leaves out are retired (refused if too few would stay). Nothing is deleted.
 * Content editors and the owner; audited with what changed.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { text, retireMissing } = await body(req, Import);
  const pack = parseDrawPack(text);
  if (!pack.ok)
    return Response.json({ error: "invalid_pack", message: pack.errors.slice(0, 3).join(" "), errors: pack.errors }, { status: 422 });
  const stored = await allFamilyWords(ctx.db);
  const plan = planDrawImport(stored, pack.items, !!retireMissing);
  if (plan.retire.length) keepEnough(activeAfter(stored, plan));

  const now = new Date().toISOString();
  const by = ctx.user.id;
  let sort = stored.reduce((m, r) => Math.max(m, r.sort), 0);
  if (plan.add.length) {
    const { error } = await ctx.db
      .from("family_draw_words")
      .insert(plan.add.map((w) => ({ word: w.word, alt: w.alt ?? [], sort: ++sort, created_by: by, updated_by: by })));
    wordClash(error);
  }
  for (const u of plan.update) {
    const { error } = await ctx.db
      .from("family_draw_words")
      .update({ alt: u.alt, updated_at: now, updated_by: by, ...(u.restore && { retired_at: null, retired_by: null }) })
      .eq("id", u.id);
    wordClash(error);
  }
  if (plan.retire.length) {
    const { error } = await ctx.db
      .from("family_draw_words")
      .update({ retired_at: now, retired_by: by, updated_at: now, updated_by: by })
      .in(
        "id",
        plan.retire.map((r) => r.id),
      );
    wordClash(error);
  }
  forgetFamilyWords();
  const summary = {
    added: plan.add.map((w) => w.word),
    updated: plan.update.filter((u) => !u.restore).map((u) => u.word),
    restored: plan.update.filter((u) => u.restore).map((u) => u.word),
    retired: plan.retire.map((r) => r.word),
  };
  await audit(ctx, "drawword.import", "drawword:pack", { count: pack.items.length, retireMissing: !!retireMissing, ...summary });
  return ok(summary);
});
