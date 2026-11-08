import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { isContentGame, validatePayload } from "@/lib/admin/content-schemas";
import { canonical, editedEntry, reviewFrom } from "@/lib/admin/content-review";
import { forgetContentReview, reviewEntries, saveDecision, stillPlayable } from "@/lib/admin/content-review-server";

const Edit = z.object({
  game: z.string(),
  index: z.number().int().min(0),
  payload: z.unknown(),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/content/files/edit (content.write): corrects one content.ts entry (round 3, item 12). The corrected
 * entry must match the game's schema (422 with the problems) and the game must still build boards with it dealt (422
 * edit_unplayable). Players then get the corrected entry instead of the code one while the code entry is unchanged;
 * the decision counts as reviewed, is kept in the history with the corrected entry, and is audited.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { game, index, payload, notes } = await body(req, Edit);
  if (!isContentGame(game)) throw new ApiError(400, "bad_game");
  const v = validatePayload(game, payload);
  if (!v.success) return Response.json({ error: "invalid_payload", issues: v.issues }, { status: 422 });
  const { entries } = await reviewEntries(ctx.db, game);
  const e = entries[index];
  if (!e) throw new ApiError(404, "entry_not_found");
  const edit = editedEntry(payload, v.data);
  if (canonical(edit) === canonical(e.entry)) throw new ApiError(409, "no_change", "That is the entry as written. Approve it instead.");
  const next = reviewFrom(entries.map((x) => (x.index === index ? { index, state: "edited" as const, edit } : x)));
  if (!(await stillPlayable(game, next, true)))
    throw new ApiError(422, "edit_unplayable", "Boards can't be built with this entry. Check it against the others.");
  await saveDecision(ctx, game, e, "edit", edit, notes || null, new Date().toISOString());
  forgetContentReview(game);
  await audit(ctx, "content_file.edit", `${game}.content`, { index, before: e.entry, after: edit, notes: notes || null });
  return ok({ ok: true, entry: edit });
});
