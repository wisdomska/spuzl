import { ApiError, handle, ok, rateLimit, requirePlayer, todayGmt } from "@/lib/api/server";
import { DAILY_POOL, WEEKLY_CHAIN } from "@/lib/gamification/quests";
import { weekStartOf } from "@/lib/leagues";

/**
 * POST /api/v1/quests/:id/claim: claims a completed quest's XP and Sparks.
 * Idempotent: the reward is granted once per (quest, period) by svc_grant_reward, and claimed_at is set once.
 * A retried or double-tapped claim returns the same result without paying twice.
 */
export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/v1/quests/[id]/claim">) => {
  const { id } = await ctx.params;
  const q = [...DAILY_POOL, ...WEEKLY_CHAIN].find((x) => x.id === id);
  if (!q) throw new ApiError(404, "unknown_quest");
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `quest-claim:${player.id}`, 60, 3600);
  const period = q.kind === "daily" ? todayGmt() : weekStartOf();
  const { data: row } = await admin
    .from("player_quests")
    .select("completed_at, claimed_at")
    .eq("player_id", player.id)
    .eq("quest_id", id)
    .eq("period", period)
    .maybeSingle();
  if (!row?.completed_at) throw new ApiError(409, "not_complete", "Finish the quest first.");
  const { data, error } = await admin.rpc("svc_grant_reward", {
    p_player: player.id,
    p_source: "quest",
    p_ref: `${id}:${period}`,
    p_xp: q.xp,
    p_sparks: q.sparks,
  });
  if (error) throw error;
  const g = Array.isArray(data) ? data[0] : data;
  if (!row.claimed_at)
    await admin
      .from("player_quests")
      .update({ claimed_at: new Date().toISOString() })
      .eq("player_id", player.id)
      .eq("quest_id", id)
      .eq("period", period)
      .is("claimed_at", null);
  const { data: p } = await admin.from("players").select("sparks, xp, level").eq("id", player.id).single();
  return ok({
    ok: true,
    xp: g?.xp_added ?? 0,
    sparks: g?.sparks_added ?? 0,
    already: (g?.xp_added ?? 0) === 0 && (g?.sparks_added ?? 0) === 0,
    level: { before: g?.level_before ?? p?.level, after: g?.level_after ?? p?.level },
    balance: p?.sparks ?? player.sparks,
  });
});
