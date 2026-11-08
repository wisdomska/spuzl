import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BY_ID } from "@/lib/catalog";
import { addDays } from "@/lib/admin/dates";
import { effectiveBand } from "@/lib/age";
import { isUnder16 } from "@/lib/social";
import { recapCard, type RecapCardModel, type RecapCardOptions } from "@/lib/share/recap-card";
import { buildRecap, hasRecap, type WeeklyRecap } from "./weekly";

/** The card's privacy switches for a player (under 16, hide activity), or null when unknown or banned. */
export async function recapOptions(admin: SupabaseClient, playerId: string): Promise<RecapCardOptions | null> {
  const { data: p, error } = await admin
    .from("players")
    .select("age_band, birth_year, birth_month, hide_activity, banned_at")
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw error;
  if (!p || p.banned_at) return null;
  return { minor: isUnder16(effectiveBand(p)), hideActivity: !!p.hide_activity };
}

/** The recap card for one player and week, from live rows; null when there is nothing to show. */
export async function loadRecapCard(admin: SupabaseClient, playerId: string, week: string): Promise<RecapCardModel | null> {
  const opts = await recapOptions(admin, playerId);
  if (!opts) return null;
  const recap = await loadWeeklyRecap(admin, playerId, week);
  return hasRecap(recap) ? recapCard(recap, opts) : null;
}

/** Games scored by time: only their clears can be the week's best time. */
const TIMED = Object.values(GAME_BY_ID)
  .filter((g) => g.scoring === "time")
  .map((g) => g.id);

/**
 * One player's recap of the GMT week starting `week` (a Monday), read from existing rows: attempts (clears and the
 * fastest timed clear; flagged, abandoned and tutorial runs left out), streaks, league_members of that week's league
 * and sparks_ledger. Nothing is written.
 */
export async function loadWeeklyRecap(admin: SupabaseClient, playerId: string, week: string): Promise<WeeklyRecap> {
  const lo = `${week}T00:00:00Z`;
  const hi = `${addDays(week, 7)}T00:00:00Z`;
  const cleared = () =>
    admin
      .from("attempts")
      .select("game_id, time_ms", { count: "exact" })
      .eq("player_id", playerId)
      .eq("status", "cleared")
      .neq("mode", "tutorial")
      .gte("finished_at", lo)
      .lt("finished_at", hi);
  const [count, fastest, streak, league, sparks] = await Promise.all([
    cleared().limit(1),
    cleared().in("game_id", TIMED).not("time_ms", "is", null).gt("time_ms", 0).order("time_ms", { ascending: true }).limit(1),
    admin.from("streaks").select("current").eq("player_id", playerId).maybeSingle(),
    admin
      .from("league_members")
      .select("final_rank, result, home_tier, leagues!inner(tier, week_start)")
      .eq("player_id", playerId)
      .eq("leagues.week_start", week)
      .limit(1)
      .maybeSingle(),
    admin.from("sparks_ledger").select("amount").eq("player_id", playerId).gt("amount", 0).gte("created_at", lo).lt("created_at", hi),
  ]);
  for (const r of [count, fastest, streak, league, sparks]) if (r.error) throw r.error;
  const l = league.data as { final_rank: number | null; result: string | null; home_tier: number | null; leagues: unknown } | null;
  const lg = (Array.isArray(l?.leagues) ? l?.leagues[0] : l?.leagues) as { tier: number } | undefined;
  const best = (fastest.data ?? [])[0] as { game_id: string; time_ms: number } | undefined;
  return buildRecap({
    week,
    cleared: count.count ?? 0,
    fastest: best ?? null,
    streak: (streak.data as { current: number } | null)?.current ?? 0,
    league: l && lg ? { tier: lg.tier, home_tier: l.home_tier, final_rank: l.final_rank, result: l.result } : null,
    sparks: (sparks.data ?? []) as { amount: number }[],
  });
}
