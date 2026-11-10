import { ApiError, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { packToJson, toDraft } from "@/lib/admin/quads-pack";

const STATUSES = ["draft", "in_review", "approved", "rejected", "scheduled"];
/** Most items one export holds (the console lists at most 2,000 per game). */
const MAX_ITEMS = 2000;

/**
 * GET /api/admin/content/export?game=quads&status= (content.read): R4-16, the Quads pack export built on the server so
 * every export writes an audit row (content.export: game, status filter, item count). The console's editor items of
 * that status (all when none), newest first, as the JSON pack the import reads back ({filename, json, count}).
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.read");
  const sp = new URL(req.url).searchParams;
  const game = sp.get("game");
  const status = sp.get("status") || null;
  if (game !== "quads") throw new ApiError(400, "bad_game", "Only Quads packs are exported here.");
  if (status && !STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  let q = ctx.db
    .from("content_items")
    .select("payload")
    .eq("source", "editor")
    .eq("game_id", game)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAX_ITEMS);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  await audit(ctx, "content.export", `${game}.pack`, { game, status, count: rows.length });
  return ok({ filename: `spuzl-quads-${status || "all"}.json`, json: packToJson(rows.map((r) => toDraft(r.payload))), count: rows.length });
});
