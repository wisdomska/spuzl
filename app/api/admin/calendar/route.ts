import { handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAMES, WORLDS } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { addDays, ISO_DATE, mondayOf, todayIso } from "@/lib/admin/dates";

/**
 * GET /api/admin/calendar?week=YYYY-MM-DD&world=logic: one week of Dailies per game (FR-AD-02).
 * A cell is verified (scheduled by the solver-checked pipeline, or approved), needs review, or missing.
 */
export const GET = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.read");
  const url = new URL(req.url);
  const week = url.searchParams.get("week") ?? todayIso();
  const world = url.searchParams.get("world");
  if (!ISO_DATE.test(week)) throw new ApiError(400, "bad_week");
  if (world && !WORLDS.some((w) => w.id === world)) throw new ApiError(400, "bad_world");
  const from = mondayOf(week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const games = GAMES.filter((g) => hasLogic(g.id) && (!world || g.world === world));
  const { data, error } = await ctx.db
    .from("dailies")
    .select("date, game_id, puzzle_id, locked, swapped_from, puzzles!dailies_puzzle_id_fkey(difficulty, status, source)")
    .gte("date", days[0])
    .lte("date", days[6])
    .in(
      "game_id",
      games.map((g) => g.id),
    );
  if (error) throw error;
  const byKey = new Map((data ?? []).map((r) => [`${r.game_id}|${r.date}`, r]));
  const rows = games.map((g) => ({
    game: g.id,
    name: g.name,
    world: g.world,
    cells: days.map((date) => {
      const r = byKey.get(`${g.id}|${date}`);
      if (!r) return { date, state: "missing" as const };
      const p = r.puzzles as unknown as { difficulty: string; status: string; source: string } | null;
      const review = !p || p.status === "draft" || p.status === "in_review";
      return {
        date,
        state: review ? ("review" as const) : ("verified" as const),
        puzzleId: r.puzzle_id as string,
        difficulty: p?.difficulty ?? null,
        locked: !!r.locked,
        swapped: !!r.swapped_from,
      };
    }),
  }));
  const [{ count: puzzles }, { count: reports }] = await Promise.all([
    ctx.db.from("puzzles").select("id", { count: "exact", head: true }),
    ctx.db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  return ok({ from, days, today: todayIso(), rows, counts: { puzzles: puzzles ?? 0, openReports: reports ?? 0 } });
});
