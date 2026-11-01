import { handle, ok, requirePlayer } from "@/lib/api/server";
import { cards } from "@/lib/social/server";
import {
  LEAGUE_SIZE,
  TOP_TIER,
  isoWeek,
  leagueReward,
  msToLeagueReset,
  nextTier,
  tierMeta,
  zoneFor,
  type LeagueResult,
} from "@/lib/leagues";
import { chooseLeague, type LeagueCandidate } from "@/lib/leagues/grouping";
import { getGameSettings } from "@/lib/game-settings/server";

export const dynamic = "force-dynamic";

interface MemberRow {
  player_id: string;
  points: number;
  final_rank: number | null;
  result: LeagueResult | null;
  /** set when the rollover merged this player's tier into a group of another tier */
  home_tier: number | null;
}

async function table(admin: Parameters<typeof cards>[0], leagueId: string, me: string, tier: number, finalised: boolean) {
  const { data, error } = await admin
    .from("league_members")
    .select("player_id, points, final_rank, result, home_tier")
    .eq("league_id", leagueId);
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
      // zones follow each player's own tier (a merged group holds more than one)
      zone: zoneFor(pos, n, r.home_tier ?? tier),
      tier: r.home_tier ?? tier,
      me: c.id === me,
    };
  });
}

interface Candidates {
  eligible: boolean;
  /** already placed this week: the league, so the route needs no join call */
  league?: { id: string; tier: number; weekStart: string };
  tier?: number;
  level?: number;
  isNew?: boolean;
  candidates?: (Omit<LeagueCandidate, "avgLevel"> & { avgLevel: number | string })[];
}

type Placement = { placed: { id: string; tier: number; week_start: string } } | { placed: null; pick: string | null };

/**
 * This week's league for a player already placed (one call), or where a player joining should go (SPZ-21):
 * friends first for new players, then a level-matched group at their tier, topping up small groups (game
 * settings leagues.fillWithFriends and leagues.minGroup). The database re-checks the pick under its join lock.
 */
async function placement(admin: Parameters<typeof cards>[0], playerId: string): Promise<Placement> {
  const { data, error } = await admin.rpc("svc_league_candidates", { p_player: playerId });
  if (error) throw error;
  const c = data as Candidates;
  if (c?.league) return { placed: { id: c.league.id, tier: c.league.tier, week_start: c.league.weekStart } };
  if (!c?.eligible) return { placed: null, pick: null };
  const settings = await getGameSettings();
  const pick = chooseLeague(
    { tier: c.tier ?? 0, level: c.level ?? 1, isNew: !!c.isNew },
    (c.candidates ?? []).map((x) => ({ ...x, avgLevel: Number(x.avgLevel) })),
    { size: LEAGUE_SIZE, minGroup: settings["leagues.minGroup"], fillWithFriends: settings["leagues.fillWithFriends"] },
  );
  return { placed: null, pick };
}

/** Joins this week's league if the player has earned a place, and returns it (null: not in a league this week). */
async function currentLeague(admin: Parameters<typeof cards>[0], playerId: string) {
  const p = await placement(admin, playerId);
  if (p.placed) return p.placed;
  const { data: lid, error } = await admin.rpc("svc_join_current_league", { p_player: playerId, p_league: p.pick });
  if (error) throw error;
  if (!lid) return null;
  const { data: l } = await admin.from("leagues").select("id, tier, week_start").eq("id", lid).single();
  return l;
}

/**
 * GET /api/v1/leagues/current: this week's table (30 players, top 7 up, bottom 5 down), time left, and the
 * week-end ceremony if last week's result hasn't been seen yet. Clearing a Daily midweek joins a league.
 */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const l = await currentLeague(admin, player.id);

  let league = null;
  if (l) {
    const members = await table(admin, l.id, player.id, l.tier, false);
    // A player merged into a group of another tier still sees (and moves from) their own tier.
    const tier = members.find((m) => m.me)?.tier ?? l.tier;
    const meta = tierMeta(tier);
    league = {
      id: l.id,
      tier,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      next: tier < TOP_TIER ? tierMeta(tier + 1).name : null,
      prev: tier > 0 ? tierMeta(tier - 1).name : null,
      weekStart: l.week_start,
      endsInMs: msToLeagueReset(),
      members,
    };
  }

  // Ceremony: the most recent finalised week this player hasn't seen.
  let ceremony = null;
  const { data: pending } = await admin
    .from("league_members")
    .select("league_id, points, final_rank, result, home_tier, leagues!inner(id, tier, week_start, finalised_at)")
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
    const from = latest.home_tier ?? latest.league.tier;
    const to = nextTier(result, from);
    ceremony = {
      leagueId: latest.league_id,
      week: isoWeek(latest.league.week_start),
      result,
      rank: latest.final_rank,
      n: rows.length,
      points: latest.points,
      from: tierMeta(from),
      to: tierMeta(to),
      toTier: to,
      reward: leagueReward(result, from),
      // the rows just above you, so your row can fly up past them
      around: rows.filter((r) => Math.abs(r.pos - (latest.final_rank ?? 0)) <= 2),
    };
  }

  return ok({ league, ceremony });
});
