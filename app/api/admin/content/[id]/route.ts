import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { validatePayload } from "@/lib/admin/content-schemas";
import { ITEM_COLS } from "@/lib/admin/content-files";

const Id = z.string().uuid();

/** GET /api/admin/content/:id */
export const GET = handle(async (_req: Request, rc: RouteContext<"/api/admin/content/[id]">) => {
  const ctx = await requireAdmin("content.read");
  const id = Id.parse((await rc.params).id);
  const { data } = await ctx.db.from("content_items").select(ITEM_COLS).eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "item_not_found");
  return ok({ ...data, me: ctx.user.id });
});

const Patch = z.object({
  payload: z.unknown().optional(),
  notes: z.string().max(2000).optional(),
  submit: z.boolean().optional(),
});

/**
 * PATCH /api/admin/content/:id: the author edits a draft or rejected item, and may submit it for review.
 * Submitting needs a valid payload; editing an item in review sends it back to draft.
 */
export const PATCH = handle(async (req: Request, rc: RouteContext<"/api/admin/content/[id]">) => {
  const ctx = await requireAdmin("content.write");
  const id = Id.parse((await rc.params).id);
  const patch = await body(req, Patch);
  const { data: item } = await ctx.db.from("content_items").select("id, game_id, payload, author_id, status").eq("id", id).maybeSingle();
  if (!item) throw new ApiError(404, "item_not_found");
  if (item.author_id !== ctx.user.id && ctx.role !== "owner") throw new ApiError(403, "not_author", "Only the author edits an item.");
  if (!["draft", "rejected", "in_review"].includes(item.status)) throw new ApiError(409, "not_editable", "Approved items are read-only.");
  const payload = patch.payload === undefined ? item.payload : patch.payload;
  const v = validatePayload(item.game_id, payload);
  if (!v.success) return Response.json({ error: "invalid_payload", issues: v.issues }, { status: 422 });
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { payload: v.data, updated_at: now };
  if (patch.notes !== undefined) update.notes = patch.notes || null;
  if (patch.submit) Object.assign(update, { status: "in_review", submitted_at: now, reviewer_id: null, reviewed_at: null });
  else if (patch.payload !== undefined) Object.assign(update, { status: "draft", reviewer_id: null, reviewed_at: null });
  const { data, error } = await ctx.db.from("content_items").update(update).eq("id", id).select(ITEM_COLS).single();
  if (error) throw error;
  await audit(ctx, patch.submit ? "content.submit" : "content.edit", `content:${id}`, { game: item.game_id });
  return ok(data);
});
