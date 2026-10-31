import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { CONTENT_GAMES, isContentGame, validatePayload } from "@/lib/admin/content-schemas";
import { ITEM_COLS } from "@/lib/admin/content-files";

const STATUSES = ["draft", "in_review", "approved", "rejected", "scheduled"];

/** GET /api/admin/content?status=&game=: editor items, newest first, with author and reviewer emails. */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.read");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const game = url.searchParams.get("game");
  if (status && !STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  if (game && !isContentGame(game)) throw new ApiError(400, "bad_game");
  let q = ctx.db.from("content_items").select(ITEM_COLS).eq("source", "editor").order("updated_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  if (game) q = q.eq("game_id", game);
  const { data, error } = await q;
  if (error) throw error;
  const ids = [...new Set((data ?? []).flatMap((r) => [r.author_id, r.reviewer_id]).filter(Boolean))] as string[];
  const { data: admins } = ids.length ? await ctx.db.from("admins").select("user_id, email").in("user_id", ids) : { data: [] };
  const email = Object.fromEntries((admins ?? []).map((a) => [a.user_id, a.email]));
  return ok({
    me: ctx.user.id,
    games: CONTENT_GAMES,
    rows: (data ?? []).map((r) => ({
      ...r,
      author_email: email[r.author_id] ?? null,
      reviewer_email: r.reviewer_id ? (email[r.reviewer_id] ?? null) : null,
    })),
  });
});

const Create = z.object({ game: z.string(), payload: z.unknown(), notes: z.string().max(2000).optional() });

/** POST /api/admin/content: a new draft. The payload must already match the game's schema. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { game, payload, notes } = await body(req, Create);
  if (!isContentGame(game)) throw new ApiError(400, "bad_game");
  const v = validatePayload(game, payload);
  if (!v.success) return Response.json({ error: "invalid_payload", issues: v.issues }, { status: 422 });
  const { data, error } = await ctx.db
    .from("content_items")
    .insert({ game_id: game, payload: v.data, notes: notes || null, author_id: ctx.user.id, status: "draft", source: "editor" })
    .select(ITEM_COLS)
    .single();
  if (error) throw error;
  await audit(ctx, "content.create", `content:${data.id}`, { game });
  return ok(data);
});
