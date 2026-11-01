import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAME_BY_ID } from "@/lib/catalog";
import { fetchPage, pageParams, sortParams } from "@/lib/admin/paging";
import { rangeOf } from "@/lib/admin/pagination";
import { PUZZLE_SORT } from "@/lib/admin/sorting";

const STATUSES = ["draft", "in_review", "approved", "scheduled", "retired"];
const SOURCES = ["generated", "human"];
/** Sort key to column (allow-listed in PUZZLE_SORT). */
const COLUMN = {
  created_at: "created_at",
  game: "game_id",
  grade: "grade",
  status: "status",
  source: "source",
  checked_at: "checked_at",
} as const;

/**
 * GET /api/admin/puzzles?game=&status=&source=&sort=&dir=&page=&pageSize=: the puzzle library, newest first by
 * default (any allow-listed column otherwise; id breaks ties), without solutions. `offset` (the first row's index) is kept in the response for older callers.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.read");
  const url = new URL(req.url);
  const p = pageParams(url.searchParams);
  const game = url.searchParams.get("game");
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const { sort, dir } = sortParams(url.searchParams, PUZZLE_SORT);
  const asc = dir === "asc";
  if (source && !SOURCES.includes(source)) throw new ApiError(400, "bad_source");
  if (game && !GAME_BY_ID[game]) throw new ApiError(400, "bad_game");
  if (status && !STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  const { rows, total } = await fetchPage(() => {
    let q = ctx.db
      .from("puzzles")
      .select("id, game_id, seed, difficulty, grade, source, status, created_at, checked_at, dailies!dailies_puzzle_id_fkey(date)", {
        count: "exact",
      })
      .order(COLUMN[sort], { ascending: asc, nullsFirst: false })
      .order("id", { ascending: asc });
    if (game) q = q.eq("game_id", game);
    if (status) q = q.eq("status", status);
    if (source) q = q.eq("source", source);
    return q;
  }, p);
  return ok({ rows, page: p.page, pageSize: p.pageSize, total, offset: rangeOf(p).from });
});
