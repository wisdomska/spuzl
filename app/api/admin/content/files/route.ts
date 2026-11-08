import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { can } from "@/lib/admin/roles";
import { CONTENT_GAMES, isContentGame, type ContentGame } from "@/lib/admin/content-schemas";
import { FILES } from "@/lib/admin/content-files";
import { filterEntries, REVIEW_SHOW, reviewFrom, summarise, type ReviewShow } from "@/lib/admin/content-review";
import { forgetContentReview, reviewEntries, saveDecision, stillPlayable, type ReviewEntry } from "@/lib/admin/content-review-server";
import { slicePage } from "@/lib/admin/pagination";
import { pageParams } from "@/lib/admin/paging";

/** The games in the review queue: every content.ts whose code says its content needs review. */
async function queueGames(): Promise<ContentGame[]> {
  const flags = await Promise.all(CONTENT_GAMES.map(async (g) => [g, (await FILES[g]()).needsReview] as const));
  return flags.filter(([, f]) => f).map(([g]) => g);
}

/**
 * GET /api/admin/content/files?game=&show=todo|all|approved|edited|retired&q=&page=&pageSize= (content.read): the
 * review queue (round 3, item 12). Without `game`, a summary per game in the queue: entries, reviewed, approved,
 * edited, retired, changed since review, still to do, and `needsReview` derived from the reviews (it clears once
 * every entry is reviewed). With `game`, that summary plus one page of its entries in file order (filtered and
 * searched; `show` defaults to all) as `games[0].entries`, each with its state, the edited entry players get, notes,
 * reviewer and time, plus `page`, `pageSize` and `total`.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.read");
  const sp = new URL(req.url).searchParams;
  const p = pageParams(sp);
  const game = sp.get("game");
  const show = (sp.get("show") ?? "all") as ReviewShow;
  const q = (sp.get("q") ?? "").slice(0, 80);
  if (game && !isContentGame(game)) throw new ApiError(400, "bad_game");
  if (!REVIEW_SHOW.includes(show)) throw new ApiError(400, "bad_show");
  const canReview = can(ctx.role, "content.write");
  const games = game ? [game as ContentGame] : await queueGames();
  const read = await Promise.all(games.map(async (g) => ({ game: g, ...(await reviewEntries(ctx.db, g)) })));
  const summaries = read.map((r) => ({
    game: r.game,
    codeFlag: r.codeFlag,
    ...summarise(
      r.entries.map((e) => e.state),
      r.codeFlag,
    ),
  }));
  if (!game) return ok({ canReview, games: summaries });

  const page = slicePage(filterEntries(read[0].entries, show, q), p);
  const ids = [...new Set(page.rows.map((e) => e.reviewer_id).filter(Boolean))] as string[];
  const { data: admins } = ids.length ? await ctx.db.from("admins").select("user_id, email").in("user_id", ids) : { data: [] };
  const email = Object.fromEntries((admins ?? []).map((a) => [a.user_id, a.email]));
  const entries = page.rows.map((e) => ({
    index: e.index,
    entry: e.entry,
    edit: e.edit,
    state: e.state,
    notes: e.notes,
    reviewed_at: e.reviewed_at,
    reviewer: e.reviewer_id ? (e.reviewer_id === ctx.user.id ? "you" : (email[e.reviewer_id] ?? null)) : null,
  }));
  return ok({ canReview, page: page.page, pageSize: page.pageSize, total: page.total, games: [{ ...summaries[0], entries }] });
});

const Body = z.object({
  game: z.string(),
  indexes: z.array(z.number().int().min(0)).min(1).max(200),
  // "reject" is the earlier name for retire (the owner's review before round 3)
  decision: z.enum(["approve", "retire", "reject"]),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/content/files (content.write): approve or retire content.ts entries (up to 200 at once). Approving
 * a retired entry brings it back. Retiring is refused (409 too_few_left) when the game would no longer deal full
 * boards. Each entry's decision is stored with who and when, kept in the review history, and audited.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("content.write");
  const { game, indexes, decision: asked, notes } = await body(req, Body);
  if (!isContentGame(game)) throw new ApiError(400, "bad_game");
  const decision = asked === "approve" ? "approve" : "retire";
  const { entries } = await reviewEntries(ctx.db, game);
  const picked = [...new Set(indexes)].map((i) => entries[i] ?? null);
  if (picked.some((e) => !e)) throw new ApiError(404, "entry_not_found");
  if (decision === "retire") {
    const set = new Set(indexes);
    const next = reviewFrom(entries.map((e) => (set.has(e.index) ? { index: e.index, state: "retired" as const } : e)));
    if (!(await stillPlayable(game, next)))
      throw new ApiError(409, "too_few_left", "Retiring these would leave too few entries for full boards. Edit some instead.");
  }
  const now = new Date().toISOString();
  for (const e of picked as ReviewEntry[]) await saveDecision(ctx, game, e, decision, e.entry, notes || null, now);
  forgetContentReview(game);
  await audit(ctx, `content_file.${decision}`, `${game}.content`, { indexes: picked.map((e) => e!.index), notes: notes || null });
  return ok({ ok: true, count: picked.length });
});
