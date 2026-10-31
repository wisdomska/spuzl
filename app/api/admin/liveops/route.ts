import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAME_BY_ID } from "@/lib/catalog";
import { addDays, todayIso } from "@/lib/admin/dates";

interface Kpis {
  players_now: number;
  dau: number;
  dau_yesterday: number;
  dau_last_week: number;
  clears_today: number;
  flagged: number;
  open_reports: number;
}

/**
 * GET /api/admin/liveops (FR-AD-06): DAU, clears per game today, D1 and D7 retention, streak distribution,
 * flagged-score count and 24 h activity. Every number comes from service-role-only RPCs in the admin migration.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin("liveops.read");
  const today = todayIso();
  const [kpis, byGame, retention, streaks, series, missing, unlocked] = await Promise.all([
    ctx.db.rpc("svc_admin_kpis", { p_today: today }),
    ctx.db.rpc("svc_admin_clears_by_game", { p_date: today }),
    ctx.db.rpc("svc_admin_retention", { p_today: today }),
    ctx.db.rpc("svc_admin_streak_distribution"),
    ctx.db.rpc("svc_admin_activity_series", { p_now: new Date().toISOString() }),
    ctx.db.from("dailies").select("date, game_id").gte("date", today).lte("date", addDays(today, 6)),
    ctx.db
      .from("dailies")
      .select("date", { count: "exact", head: true })
      .eq("locked", false)
      .gte("date", today)
      .lte("date", addDays(today, 7)),
  ]);
  for (const r of [kpis, byGame, retention, streaks, series]) if (r.error) throw r.error;

  // Alerts: the next 7 days must have every live Daily, locked.
  const { data: live } = await ctx.db.from("games").select("id").eq("status", "live");
  const have = new Set((missing.data ?? []).map((d) => `${d.game_id}|${d.date}`));
  const gaps: { game: string; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    for (const g of live ?? []) if (GAME_BY_ID[g.id] && !have.has(`${g.id}|${date}`)) gaps.push({ game: g.id, date });
  }

  const games = (byGame.data as { game_id: string; clears: number; median_ms: number | null; free_clears: number }[])
    .map((g) => ({ ...g, name: GAME_BY_ID[g.game_id]?.name ?? g.game_id, world: GAME_BY_ID[g.game_id]?.world ?? "logic" }))
    .sort((a, b) => b.clears - a.clears || b.free_clears - a.free_clears);

  return ok({
    now: new Date().toISOString(),
    kpis: kpis.data as Kpis,
    retention: retention.data as { d1: number | null; d1_cohort: number; d7: number | null; d7_cohort: number },
    byGame: games,
    streaks: streaks.data as { bucket: string; sort: number; players: number }[],
    series: series.data as { slot_start: string; players: number }[],
    alerts: { gaps: gaps.slice(0, 20), gapCount: gaps.length, unlocked: unlocked.count ?? 0 },
  });
});
