import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";
import { friendshipBetween, isBlockedPair, toCard } from "@/lib/social/server";
import { presenceFor } from "@/lib/social";
import { gameStats } from "@/lib/meta/server";
import { tierMeta, weekStartOf } from "@/lib/leagues";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/players/:nickname: another player's public profile.
 * Under-16s show nickname and avatar only. Presence and head-to-head only between friends.
 * A block in either direction looks the same as "not found".
 */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/players/[nickname]">) => {
  const { nickname } = await ctx.params;
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nickname)) throw new ApiError(404, "not_found");
  const { admin, player } = await requirePlayer();
  const { data: p } = await admin
    .from("players")
    .select("id, nickname, avatar_color, skin, hat, title, level, age_band, hide_activity, last_seen_at, playing_game, banned_at")
    .eq("nickname", nickname)
    .maybeSingle();
  if (!p || p.banned_at) throw new ApiError(404, "not_found", "No Spuzler with that name.");
  if (p.id !== player.id && (await isBlockedPair(admin, player.id, p.id)))
    throw new ApiError(404, "not_found", "No Spuzler with that name.");

  const f = p.id === player.id ? null : await friendshipBetween(admin, player.id, p.id);
  const relation =
    p.id === player.id ? "self" : f?.status === "accepted" ? "friend" : f ? (f.player_id === player.id ? "requested" : "incoming") : "none";
  const card = toCard(p);
  if (card.minor) return ok({ ...card, relation, public: false });

  const friend = relation === "friend";
  const [{ data: streak }, theirs, { data: league }] = await Promise.all([
    admin.from("streaks").select("current").eq("player_id", p.id).maybeSingle(),
    gameStats(admin, p.id),
    admin
      .from("league_members")
      .select("leagues!inner(tier, week_start)")
      .eq("player_id", p.id)
      .eq("leagues.week_start", weekStartOf())
      .maybeSingle(),
  ]);
  const tier = (league?.leagues as unknown as { tier: number } | undefined)?.tier;

  let versus = null;
  if (friend) {
    const [{ data: rec }, mine] = await Promise.all([admin.rpc("svc_duel_record", { a: player.id, b: p.id }), gameStats(admin, player.id)]);
    const r = Array.isArray(rec) ? rec[0] : rec;
    versus = { me: r?.wins_a ?? 0, them: r?.wins_b ?? 0, myBest: mine[0]?.game ?? null, theirBest: theirs[0]?.game ?? null };
  }
  return ok({
    ...card,
    relation,
    public: true,
    presence: friend && !p.hide_activity ? presenceFor(p.last_seen_at, p.playing_game) : null,
    streak: streak?.current ?? 0,
    clears: theirs.reduce((n, s) => n + s.clears, 0),
    league: tier === undefined ? null : tierMeta(tier).name,
    versus,
  });
});
