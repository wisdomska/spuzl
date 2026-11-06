import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { ITEM_COLS } from "@/lib/admin/content-files";
import { parsePack } from "@/lib/admin/quads-pack";

const Import = z.object({ game: z.literal("quads"), text: z.string().max(400_000) });

/**
 * POST /api/admin/content/import: a Quads pack (lib/admin/quads-pack.ts) becomes drafts, one per puzzle, by the
 * caller, for the usual two-person review. All or nothing: any problem in the file and nothing is saved (422 with
 * every problem listed). Content editors and the owner; audited with the count.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { game, text } = await body(req, Import);
  const pack = parsePack(text);
  if (!pack.ok)
    return Response.json({ error: "invalid_pack", message: pack.errors.slice(0, 3).join(" "), errors: pack.errors }, { status: 422 });
  const rows = pack.puzzles.map((payload) => ({
    game_id: game,
    payload,
    notes: "Imported from a Quads pack",
    author_id: ctx.user.id,
    status: "draft",
    source: "editor",
  }));
  const { data, error } = await ctx.db.from("content_items").insert(rows).select(ITEM_COLS);
  if (error) throw error;
  if (!data?.length) throw new ApiError(500, "import_failed");
  await audit(ctx, "content.import", `content:${game}`, { game, count: data.length });
  return ok({ created: data.length, ids: data.map((r) => r.id) });
});
