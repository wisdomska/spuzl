import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { todayIso } from "@/lib/admin/dates";

/**
 * GET /api/admin/overview: the admin home widgets. Player totals (guests and signed in, new and active today and
 * over 7 days, sign-in method and age band splits) plus the live-ops KPIs the console already computes (DAU, open
 * reports, flagged scores). Test players are left out. Days are GMT.
 */
export const GET = handle(async () => {
  const ctx = await requireAdmin("players.read");
  const today = todayIso();
  const [players, kpis] = await Promise.all([
    ctx.db.rpc("svc_admin_player_overview", { p_today: today }),
    ctx.db.rpc("svc_admin_kpis", { p_today: today }),
  ]);
  if (players.error) throw players.error;
  if (kpis.error) throw kpis.error;
  return ok({ players: players.data, kpis: kpis.data });
});
