import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { validatePayload } from "@/lib/admin/content-schemas";
import { ITEM_COLS } from "@/lib/admin/content-files";

const Body = z.object({ decision: z.enum(["approve", "reject"]), notes: z.string().max(2000).optional() });

/**
 * POST /api/admin/content/:id/review: the second person approves or rejects an item in review.
 * The author can never review their own item (checked here and by the database constraint).
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/content/[id]/review">) => {
  const ctx = await requireAdmin("content.approve");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const { decision, notes } = await body(req, Body);
  const { data: item } = await ctx.db
    .from("content_items")
    .select("id, game_id, payload, author_id, status, notes")
    .eq("id", id)
    .maybeSingle();
  if (!item) throw new ApiError(404, "item_not_found");
  if (item.author_id === ctx.user.id) throw new ApiError(403, "own_item", "A second person must review this item.");
  if (item.status !== "in_review") throw new ApiError(409, "not_in_review");
  if (decision === "approve" && !validatePayload(item.game_id, item.payload).success) throw new ApiError(422, "invalid_payload");
  const now = new Date().toISOString();
  const { data, error } = await ctx.db
    .from("content_items")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewer_id: ctx.user.id,
      reviewed_at: now,
      updated_at: now,
      notes: notes ? notes : item.notes,
    })
    .eq("id", id)
    .eq("status", "in_review")
    .select(ITEM_COLS)
    .maybeSingle();
  if (error) {
    if (error.code === "23514") throw new ApiError(403, "own_item");
    throw error;
  }
  if (!data) throw new ApiError(409, "not_in_review");
  await audit(ctx, `content.${decision}`, `content:${id}`, { game: item.game_id, notes });
  return ok(data);
});
