import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { validatePayload } from "@/lib/admin/content-schemas";
import { ITEM_COLS } from "@/lib/admin/content-files";
import { forgetQuadsPool } from "@/lib/game/quads-pool";

const Body = z.object({ pooled: z.boolean() });

/**
 * POST /api/admin/content/:id/pool {pooled} (content.write): R4-15, one click puts an approved Quads item in free play
 * (dealt mixed with games/quads/content.ts) or takes it out. Only editor items that passed review (approved or
 * scheduled) and still match the Quads format; the database checks too. Audited as content.pool / content.unpool.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/content/[id]/pool">) => {
  const ctx = await requireAdmin("content.write");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const { pooled } = await body(req, Body);
  const { data: item } = await ctx.db.from("content_items").select("id, game_id, payload, status, source").eq("id", id).maybeSingle();
  if (!item) throw new ApiError(404, "item_not_found");
  if (item.game_id !== "quads" || item.source !== "editor")
    throw new ApiError(409, "not_poolable", "Only Quads items written in the console join free play this way.");
  if (pooled && !["approved", "scheduled"].includes(item.status))
    throw new ApiError(409, "not_approved", "Only approved items can join free play.");
  if (pooled && !validatePayload("quads", item.payload).success) throw new ApiError(422, "invalid_payload");
  const now = new Date().toISOString();
  const { data, error } = await ctx.db
    .from("content_items")
    .update(pooled ? { pooled_at: now, pooled_by: ctx.user.id, updated_at: now } : { pooled_at: null, pooled_by: null, updated_at: now })
    .eq("id", id)
    .select(ITEM_COLS)
    .single();
  if (error) throw error;
  forgetQuadsPool();
  await audit(ctx, pooled ? "content.pool" : "content.unpool", `content:${id}`, { game: item.game_id });
  return ok(data);
});
