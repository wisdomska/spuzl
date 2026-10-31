import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAME_BY_ID } from "@/lib/catalog";

const STATUSES = ["draft", "in_review", "approved", "scheduled", "retired"];

/** GET /api/admin/puzzles?game=&status=&offset=: the puzzle library, newest first (no solutions in the list). */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.read");
  const url = new URL(req.url);
  const game = url.searchParams.get("game");
  const status = url.searchParams.get("status");
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  if (game && !GAME_BY_ID[game]) throw new ApiError(400, "bad_game");
  if (status && !STATUSES.includes(status)) throw new ApiError(400, "bad_status");
  let q = ctx.db
    .from("puzzles")
    .select("id, game_id, seed, difficulty, grade, source, status, created_at, checked_at, dailies!dailies_puzzle_id_fkey(date)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + 49);
  if (game) q = q.eq("game_id", game);
  if (status) q = q.eq("status", status);
  const { data, count, error } = await q;
  if (error) throw error;
  return ok({ total: count ?? 0, offset, rows: data ?? [] });
});
