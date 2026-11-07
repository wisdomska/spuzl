import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { todayIso } from "@/lib/admin/dates";

/** A device whose last push went through within this many days counts as reachable. */
const PUSH_RECENT_DAYS = 30;

/**
 * GET /api/admin/overview: the admin home widgets. Player totals (guests and signed in, new and active today and
 * over 7 days, sign-in method and age band splits) plus the live-ops KPIs the console already computes (DAU, open
 * reports, flagged scores), and push alerts (R2-ADMIN): devices with alerts on, and those a push reached in the last
 * 30 days. Test players are left out. Days are GMT.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin("players.read");
  const today = todayIso();
  const since = new Date(Date.now() - PUSH_RECENT_DAYS * 86_400_000).toISOString();
  // Counts only (head requests): no endpoint or key ever leaves the database.
  const devices = () =>
    ctx.db
      .from("push_subscriptions")
      .select("endpoint, players!inner(is_test)", { count: "exact", head: true })
      .eq("players.is_test", false);
  const [players, kpis, pushOn, pushRecent] = await Promise.all([
    ctx.db.rpc("svc_admin_player_overview", { p_today: today }),
    ctx.db.rpc("svc_admin_kpis", { p_today: today }),
    devices(),
    devices().gte("last_ok_at", since),
  ]);
  if (players.error) throw players.error;
  if (kpis.error) throw kpis.error;
  if (pushOn.error) throw pushOn.error;
  if (pushRecent.error) throw pushRecent.error;
  return ok({
    players: players.data,
    kpis: kpis.data,
    push: { devices: pushOn.count ?? 0, reached30d: pushRecent.count ?? 0 },
  });
});
