import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { levelFromXp, flameTier } from "@/lib/rewards";
import { rankFor } from "@/lib/rating/glicko2";
import { GAMES, LAUNCH_IDS } from "@/lib/catalog";
import { COSMETICS } from "@/lib/gamification/cosmetics";
import { hasLogic } from "@/games/logic-registry";
import { dailyNumber, msToReset } from "@/lib/format";
import { todayGmt } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import type { Me, Today } from "@/lib/client/api";

/** The columns `loadMe` needs from the player row (the API's requirePlayer selects a superset). */
export interface PlayerRow {
  id: string;
  xp: number;
  sparks: number;
  is_guest: boolean;
}

/**
 * The signed-in player's profile, progress and today's clears: the body of GET /api/v1/me. Shared by
 * the route and by server pages that hydrate React Query, so the first paint already has the data.
 */
export async function loadMe(user: User, player: PlayerRow, admin: SupabaseClient = supabaseAdmin()): Promise<Me> {
  const today = todayGmt();
  const guest = player.is_guest || !!user.is_anonymous;
  const [
    { data: profile },
    { data: streak },
    { data: ratings },
    { data: cleared },
    { data: equipped },
    clears,
    { data: played },
    { data: learned },
  ] = await Promise.all([
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
    admin.from("inventory").select("cosmetic_id").eq("player_id", player.id).eq("equipped", true),
    // Lifetime clears, guests only: drives the "Save your streak" prompt (SPZ-20). Members skip the count.
    guest
      ? admin
          .from("attempts")
          .select("id", { count: "exact", head: true })
          .eq("player_id", player.id)
          .eq("status", "cleared")
          .neq("mode", "tutorial")
          .then((r) => r.count ?? 0)
      : Promise.resolve(undefined),
    // Games this player has ever cleared (any mode): the guided first play is skipped for these.
    admin.from("attempts").select("game_id").eq("player_id", player.id).eq("status", "cleared").limit(2000),
    // Games this player learned in a guided first play (any device): skipped too.
    admin.from("learned_games").select("game_id").eq("player_id", player.id).limit(500),
  ]);
  // The request identity comes from JWT claims, which can lack the email (e.g. a token minted before an
  // email was linked). Signed-in players see who they are, so read it from the auth record when missing.
  let email = user.email ?? null;
  if (!email && !user.is_anonymous) {
    const { data: au } = await admin.auth.admin.getUserById(player.id);
    email = au.user?.email ?? null;
  }
  const theme = COSMETICS.find((c) => c.type === "board_theme" && (equipped ?? []).some((e) => e.cosmetic_id === c.id));
  const lv = levelFromXp(player.xp);
  const worldRatings = (ratings ?? []).filter((r) => !r.track.startsWith("duel") && !r.track.startsWith("board:"));
  const overall = worldRatings.length ? worldRatings.reduce((s, r) => s + Number(r.rating), 0) / worldRatings.length : 1000;
  return {
    id: player.id,
    guest,
    email,
    clears,
    ...profile,
    level: lv.level,
    xp: player.xp,
    xpInto: lv.into,
    xpNeed: lv.need,
    sparks: player.sparks,
    streak: { current: 0, best: 0, freezes_held: 0, last_clear_date: null, ...streak, flame: flameTier(streak?.current ?? 0) },
    rank: { rating: overall, ...rankFor(overall) },
    boardTheme: theme ? String(theme.payload.theme) : null,
    played: [...new Set((played ?? []).map((r) => r.game_id as string))],
    learned: (learned ?? []).map((r) => r.game_id as string),
    ratings: Object.fromEntries((ratings ?? []).map((r) => [r.track, Number(r.rating)])),
    today: {
      date: today,
      cleared: Object.fromEntries((cleared ?? []).map((c) => [c.game_id, c.time_ms])),
      featured: LAUNCH_IDS.length,
      featuredCleared: (cleared ?? []).filter((c) => LAUNCH_IDS.includes(c.game_id)).length,
      // Today's clears as the player sees them: the onboarding lesson lights the streak and counts as the
      // first clear of the day (SPZ-05), without marking any Daily as done.
      counted: Math.max((cleared ?? []).filter((c) => LAUNCH_IDS.includes(c.game_id)).length, streak?.last_clear_date === today ? 1 : 0),
    },
  } as Me;
}

/** Today's Dailies for every game plus this player's status per game: the body of GET /api/v1/today. */
export async function loadToday(user: User | null, admin: SupabaseClient = supabaseAdmin()): Promise<Today> {
  const date = todayGmt();
  const status: Record<string, { state: "new" | "in_progress" | "cleared"; timeMs?: number }> = {};
  if (user) {
    const { data } = await admin
      .from("attempts")
      .select("game_id, status, time_ms, first_move_at")
      .eq("player_id", user.id)
      .eq("daily_date", date)
      .eq("mode", "daily");
    // Prefetched (offline-ready) Dailies have an attempt but no move yet: they are still "new".
    for (const a of data ?? [])
      status[a.game_id] =
        a.status === "cleared" ? { state: "cleared", timeMs: a.time_ms } : a.first_move_at ? { state: "in_progress" } : { state: "new" };
  }
  return {
    signedIn: !!user,
    dailies: (await getGameSettings())["features.dailies"],
    date,
    number: dailyNumber(date),
    resetsInMs: msToReset(),
    games: GAMES.map((g) => ({ id: g.id, world: g.world, ready: hasLogic(g.id), ...(status[g.id] ?? { state: "new" as const }) })),
  };
}
