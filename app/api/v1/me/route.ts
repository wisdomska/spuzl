import { handle, ok, requirePlayer, todayGmt } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { levelFromXp, flameTier } from "@/lib/rewards";
import { rankFor } from "@/lib/rating/glicko2";
import { LAUNCH_IDS } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/** GET /api/v1/me. With ?optional=1, "no session" and "no profile yet" answer 200 null instead of 401/409. */
export const GET = handle(async (req: Request) => {
  if (new URL(req.url).searchParams.get("optional") === "1") {
    const user = await currentUser();
    if (!user) return ok(null);
    const { data } = await supabaseAdmin().from("players").select("id").eq("id", user.id).maybeSingle();
    if (!data) return ok(null);
  }
  const { admin, player, user } = await requirePlayer();
  const today = todayGmt();
  const [{ data: profile }, { data: streak }, { data: ratings }, { data: cleared }] = await Promise.all([
    admin
      .from("players")
      .select("nickname, avatar_color, skin, hat, title, age_band, country, city, settings, hide_activity, created_at")
      .eq("id", player.id)
      .single(),
    admin
      .from("streaks")
      .select("current, best, last_clear_date, freezes_held, lost_value, lost_on")
      .eq("player_id", player.id)
      .maybeSingle(),
    admin.from("ratings").select("track, rating").eq("player_id", player.id),
    admin.from("daily_results").select("game_id, time_ms").eq("player_id", player.id).eq("date", today),
  ]);
  const lv = levelFromXp(player.xp);
  const worldRatings = (ratings ?? []).filter((r) => !r.track.startsWith("duel") && !r.track.startsWith("board:"));
  const overall = worldRatings.length ? worldRatings.reduce((s, r) => s + Number(r.rating), 0) / worldRatings.length : 1000;
  return ok({
    id: player.id,
    guest: player.is_guest || !!user.is_anonymous,
    email: user.email ?? null,
    ...profile,
    level: lv.level,
    xp: player.xp,
    xpInto: lv.into,
    xpNeed: lv.need,
    sparks: player.sparks,
    streak: { current: 0, best: 0, freezes_held: 0, ...streak, flame: flameTier(streak?.current ?? 0) },
    rank: { rating: overall, ...rankFor(overall) },
    ratings: Object.fromEntries((ratings ?? []).map((r) => [r.track, Number(r.rating)])),
    today: {
      date: today,
      cleared: Object.fromEntries((cleared ?? []).map((c) => [c.game_id, c.time_ms])),
      featured: LAUNCH_IDS.length,
      featuredCleared: (cleared ?? []).filter((c) => LAUNCH_IDS.includes(c.game_id)).length,
    },
  });
});
