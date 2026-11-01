import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAME_BY_ID } from "@/lib/catalog";
import { fetchPage, pageParams } from "@/lib/admin/paging";
import { rangeOf } from "@/lib/admin/pagination";

const STATUSES = ["draft", "in_review", "approved", "scheduled", "retired"];

/**
 * GET /api/admin/puzzles?game=&status=&page=&pageSize=: the puzzle library, newest first (id breaks ties),
 * without solutions. `offset` (the first row's index) is kept in the response for older callers.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.read");
  const url = new URL(req.url);
  const p = pageParams(url.searchParams);
  const game = url.searchParams.get("game");
  const status = url.searchParams.get("status");
  if (game && !GAME_BY_ID[game]) throw new ApiError(400, "bad_game");
  if (status && !STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  const { rows, total } = await fetchPage(() => {
    let q = ctx.db
      .from("puzzles")
      .select("id, game_id, seed, difficulty, grade, source, status, created_at, checked_at, dailies!dailies_puzzle_id_fkey(date)", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (game) q = q.eq("game_id", game);
    if (status) q = q.eq("status", status);
    return q;
  }, p);
  return ok({ rows, page: p.page, pageSize: p.pageSize, total, offset: rangeOf(p).from });
});
