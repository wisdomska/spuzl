import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { isContentGame, type ContentGame } from "@/lib/admin/content-schemas";
import { fileEntry, needsReviewEntries } from "@/lib/admin/content-files";
import { slicePage } from "@/lib/admin/pagination";
import { pageParams } from "@/lib/admin/paging";

type Review = {
  source_ref: string;
  source_hash: string | null;
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

/** Review state of a content.ts entry: approved or rejected only while the entry is unchanged since. */
const stateOf = (r: Review | undefined, hash: string) =>
  !r
    ? "pending"
    : r.source_hash !== hash
      ? "changed"
      : r.status === "approved"
        ? "approved"
        : r.status === "rejected"
          ? "rejected"
          : "pending";

const SHOW = ["all", "todo"] as const;

/**
 * GET /api/admin/content/files?game=&show=all|todo&page=&pageSize=: the content.ts entries flagged
 * `needsReview`, with the owner's decision recorded per entry. With `game`, one page of that game's entries
 * (in file order; `show=todo` keeps pending and changed ones) as `entries`, plus `page`, `pageSize` and
 * `total` (entries matching `show`). Without `game`, a summary per game.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const game = sp.get("game");
  const show = (sp.get("show") ?? "all") as (typeof SHOW)[number];
  if (game && !isContentGame(game)) throw new ApiError(400, "bad_game");
  if (!SHOW.includes(show)) throw new ApiError(400, "bad_show");
  const files = await needsReviewEntries(game ? (game as ContentGame) : undefined);
  const { data } = await ctx.db
    .from("content_items")
    .select("source_ref, source_hash, status, reviewer_id, reviewed_at, notes")
    .eq("source", "content_file")
    .in(
      "game_id",
      files.map((f) => f.game),
    );
  const byRef = new Map(((data ?? []) as Review[]).map((r) => [r.source_ref, r]));
  const games = files.map((f) => {
    const entries = f.entries.map((e) => {
      const state = stateOf(byRef.get(e.ref), e.hash);
      return { index: e.index, entry: e.entry, state, notes: byRef.get(e.ref)?.notes ?? null };
    });
    const shown = show === "todo" ? entries.filter((e) => e.state === "pending" || e.state === "changed") : entries;
    return {
      game: f.game,
      total: f.total,
      approved: entries.filter((e) => e.state === "approved").length,
      rejected: entries.filter((e) => e.state === "rejected").length,
      page: game ? slicePage(shown, p) : undefined,
    };
  });
  const one = game ? games[0]?.page : undefined;
  return ok({
    canApprove: ctx.role === "owner",
    ...(one && { page: one.page, pageSize: one.pageSize, total: one.total }),
    games: games.map(({ page, ...g }) => ({ ...g, entries: page?.rows })),
  });
});

const Body = z.object({
  game: z.string(),
  indexes: z.array(z.number().int().min(0)).min(1).max(200),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

/** POST /api/admin/content/files: the owner approves or rejects content.ts entries; the decision is stored in content_items. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.owner_review");
  const { game, indexes, decision, notes } = await body(req, Body);
  if (!isContentGame(game)) throw new ApiError(400, "bad_game");
  const now = new Date().toISOString();
  for (const index of [...new Set(indexes)]) {
    const e = await fileEntry(game, index);
    const row = {
      game_id: game,
      payload: e.entry,
      source: "content_file",
      source_ref: e.ref,
      source_hash: e.hash,
      status: decision === "approve" ? "approved" : "rejected",
      reviewer_id: ctx.user.id,
      reviewed_at: now,
      updated_at: now,
      needs_owner_review: false,
      notes: notes || null,
    };
    const { data: existing } = await ctx.db
      .from("content_items")
      .select("id")
      .eq("source", "content_file")
      .eq("source_ref", e.ref)
      .maybeSingle();
    const { error } = existing
      ? await ctx.db.from("content_items").update(row).eq("id", existing.id)
      : await ctx.db.from("content_items").insert(row);
    if (error) throw error;
  }
  await audit(ctx, `content_file.${decision}`, `${game}.content`, { indexes, notes });
  return ok({ ok: true, count: indexes.length });
});
