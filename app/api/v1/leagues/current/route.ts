import { handle, ok, requirePlayer } from "@/lib/api/server";
import { cards } from "@/lib/social/server";
import { TOP_TIER, isoWeek, leagueReward, msToLeagueReset, nextTier, tierMeta, zoneFor, type LeagueResult } from "@/lib/leagues";

export const dynamic = "force-dynamic";

interface MemberRow {
  player_id: string;
  points: number;
  final_rank: number | null;
  result: LeagueResult | null;
}

async function table(admin: Parameters<typeof cards>[0], leagueId: string, me: string, tier: number, finalised: boolean) {
  const { data, error } = await admin.from("league_members").select("player_id, points, final_rank, result").eq("league_id", leagueId);
  if (error) throw error;
  const rows = (data ?? []) as MemberRow[];
  const people = await cards(
    admin,
    rows.map((r) => r.player_id),
  );
  // Same order as the rollover: points desc, then id. Banned players drop out of the shown table.
  const sorted = rows
    .filter((r) => people.has(r.player_id))
    .sort((a, b) =>
      finalised && a.final_rank && b.final_rank
        ? a.final_rank - b.final_rank
        : b.points - a.points || a.player_id.localeCompare(b.player_id),
    );
  const n = sorted.length;
  return sorted.map((r, i) => {
    const c = people.get(r.player_id)!;
    const pos = finalised && r.final_rank ? r.final_rank : i + 1;
    return {
      pos,
      id: c.id,
      nickname: c.nickname,
      color: c.color,
      points: r.points,
      zone: zoneFor(pos, n, tier),
      me: c.id === me,
    };
  });
}

/**
 * GET /api/v1/leagues/current: this week's table (30 players, top 7 up, bottom 5 down), time left, and the
 * week-end ceremony if last week's result hasn't been seen yet. Clearing a Daily midweek joins a league.
 */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { data: lid, error } = await admin.rpc("svc_join_current_league", { p_player: player.id });
  if (error) throw error;

  let league = null;
  if (lid) {
    const { data: l } = await admin.from("leagues").select("id, tier, week_start").eq("id", lid).single();
    if (l) {
      const members = await table(admin, l.id, player.id, l.tier, false);
      const meta = tierMeta(l.tier);
      league = {
        id: l.id,
        tier: l.tier,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        next: l.tier < TOP_TIER ? tierMeta(l.tier + 1).name : null,
        prev: l.tier > 0 ? tierMeta(l.tier - 1).name : null,
        weekStart: l.week_start,
        endsInMs: msToLeagueReset(),
        members,
      };
    }
  }

  // Ceremony: the most recent finalised week this player hasn't seen.
  let ceremony = null;
  const { data: pending } = await admin
    .from("league_members")
    .select("league_id, points, final_rank, result, leagues!inner(id, tier, week_start, finalised_at)")
    .eq("player_id", player.id)
    .eq("ceremony_seen", false)
    .not("leagues.finalised_at", "is", null)
    .not("result", "is", null);
  const latest = (pending ?? [])
    .map((p) => ({ ...p, league: p.leagues as unknown as { id: string; tier: number; week_start: string } }))
    .sort((a, b) => b.league.week_start.localeCompare(a.league.week_start))[0];
  if (latest) {
    const rows = await table(admin, latest.league_id, player.id, latest.league.tier, true);
    const result = latest.result as LeagueResult;
    const to = nextTier(result, latest.league.tier);
    ceremony = {
      leagueId: latest.league_id,
      week: isoWeek(latest.league.week_start),
      result,
      rank: latest.final_rank,
      n: rows.length,
      points: latest.points,
      from: tierMeta(latest.league.tier),
      to: tierMeta(to),
      toTier: to,
      reward: leagueReward(result, latest.league.tier),
      // the rows just above you, so your row can fly up past them
      around: rows.filter((r) => Math.abs(r.pos - (latest.final_rank ?? 0)) <= 2),
    };
  }

  return ok({ league, ceremony });
});
