import { handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { todayIso } from "@/lib/admin/dates";
import { can } from "@/lib/admin/roles";
import { newFeedbackCount } from "@/lib/admin/feedback-server";

/** A device whose last push went through within this many days counts as reachable. */
const PUSH_RECENT_DAYS = 30;

/**
 * GET /api/admin/overview: the admin home widgets. Player totals (guests and signed in, new and active today and
 * over 7 days, sign-in method and age band splits) plus the live-ops KPIs the console already computes (DAU, open
 * reports, flagged scores), and push alerts (R2-ADMIN): devices with alerts on, and those a push reached in the last
 * 30 days, plus (round 3, item 13) the distinct players behind each count, through svc_admin_push_players. Test
 * players are left out. R4-02: contact-form messages still marked new (null without feedback.read or before the
 * feedback table exists). Days are GMT. The player counts are null until that function exists (migration not applied).
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
  const [players, kpis, pushOn, pushRecent, pushPlayers, newFeedback] = await Promise.all([
    ctx.db.rpc("svc_admin_player_overview", { p_today: today }),
    ctx.db.rpc("svc_admin_kpis", { p_today: today }),
    devices(),
    devices().gte("last_ok_at", since),
    ctx.db.rpc("svc_admin_push_players", { p_since: since }),
    can(ctx.role, "feedback.read") ? newFeedbackCount(ctx.db) : Promise.resolve(null),
  ]);
  if (players.error) throw players.error;
  if (kpis.error) throw kpis.error;
  if (pushOn.error) throw pushOn.error;
  if (pushRecent.error) throw pushRecent.error;
  const people = pushPlayers.error ? null : (pushPlayers.data as { players_on: number; players_reached: number } | null);
  return ok({
    players: players.data,
    kpis: kpis.data,
    push: {
      devices: pushOn.count ?? 0,
      reached30d: pushRecent.count ?? 0,
      players: people?.players_on ?? null,
      playersReached30d: people?.players_reached ?? null,
    },
    newFeedback,
  });
});
