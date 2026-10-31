import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { leagueReward, nextTier, tierMeta, type LeagueResult } from "@/lib/leagues";

const Claim = z.object({ leagueId: z.uuid() });

/**
 * POST /api/v1/leagues/ceremony: claim last week's league reward and mark the ceremony seen.
 * Idempotent: the reward is granted once per league (svc_grant_reward source "league", ref league id).
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `league-claim:${player.id}`, 30, 3600);
  const { leagueId } = await body(req, Claim);
  const { data: m } = await admin
    .from("league_members")
    .select("result, leagues!inner(tier, finalised_at)")
    .eq("league_id", leagueId)
    .eq("player_id", player.id)
    .maybeSingle();
  const l = m?.leagues as unknown as { tier: number; finalised_at: string | null } | undefined;
  if (!m || !l) throw new ApiError(404, "not_found");
  if (!l.finalised_at || !m.result) throw new ApiError(409, "week_running", "This week isn't over yet.");
  const result = m.result as LeagueResult;
  const sparks = leagueReward(result, l.tier);
  let added = 0;
  if (sparks > 0) {
    const { data, error } = await admin.rpc("svc_grant_reward", {
      p_player: player.id,
      p_source: "league",
      p_ref: leagueId,
      p_xp: 0,
      p_sparks: sparks,
    });
    if (error) throw error;
    added = (Array.isArray(data) ? data[0] : data)?.sparks_added ?? 0;
  }
  if (added > 0 && result === "promoted")
    await admin
      .from("feed_events")
      .insert({ player_id: player.id, kind: "promotion", payload: { tier: tierMeta(nextTier(result, l.tier)).name } });
  await admin.from("league_members").update({ ceremony_seen: true }).eq("league_id", leagueId).eq("player_id", player.id);
  const { data: p } = await admin.from("players").select("sparks").eq("id", player.id).single();
  return ok({ ok: true, sparks: added, balance: p?.sparks ?? player.sparks });
});
