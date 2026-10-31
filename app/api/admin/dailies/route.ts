import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ISO_DATE, todayIso } from "@/lib/admin/dates";
import { dailyNumber } from "@/lib/format";
import { difficultyForDate } from "@/games/types";

/** GET /api/admin/dailies?date=&game=: one Daily slot (or null when missing) with its lock and swap state. */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.read");
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date") ?? "";
  const game = sp.get("game") ?? "";
  if (!ISO_DATE.test(date) || !/^[a-z]{2,20}$/.test(game)) throw new ApiError(400, "bad_request");
  const { data, error } = await ctx.db
    .from("dailies")
    .select("date, game_id, puzzle_id, locked, locked_at, published_at, swapped_from, swapped_at")
    .eq("date", date)
    .eq("game_id", game)
    .maybeSingle();
  if (error) throw error;
  return ok({ slot: data, number: dailyNumber(date), difficulty: difficultyForDate(date), today: todayIso() });
});
