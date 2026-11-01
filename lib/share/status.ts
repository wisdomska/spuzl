import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GAMES, LAB_GAMES, WORLDS } from "@/lib/catalog";
import { getGameSettings } from "@/lib/game-settings/server";
import { gameStats } from "@/lib/meta/server";
import { rankFor } from "@/lib/rating/glicko2";
import { isUnder16 } from "@/lib/social";
import { favouriteWorld, statusCard, type StatusCardModel } from "./card-model";

/**
 * The status card for one player, from live rows (the card route and GET /api/v1/me/status-card share it).
 * Null when the player is unknown or banned. Reads nickname, colour, hat, level, age band and the hide-activity
 * switch; never city, school, email or anything else personal.
 */
export async function loadStatusCard(admin: SupabaseClient, playerId: string): Promise<StatusCardModel | null> {
  const [{ data: p }, { data: streak }, { data: ratings }, stats, settings] = await Promise.all([
    admin.from("players").select("nickname, avatar_color, hat, level, age_band, hide_activity, banned_at").eq("id", playerId).maybeSingle(),
    admin.from("streaks").select("current").eq("player_id", playerId).maybeSingle(),
    admin.from("ratings").select("track, rating, games").eq("player_id", playerId),
    gameStats(admin, playerId),
    getGameSettings(),
  ]);
  if (!p || p.banned_at) return null;
  const shown = settings["features.newGames"] ? [...GAMES, ...LAB_GAMES] : GAMES;
  const shownIds = new Set(shown.map((g) => g.id));
  const tried = stats.filter((s) => s.clears > 0 && shownIds.has(s.game));
  const worldIds = new Set<string>(WORLDS.map((w) => w.id));
  const rated = (ratings ?? []).filter((r) => worldIds.has(r.track) && Number(r.games) > 0);
  const overall = rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : null;
  return statusCard({
    nickname: p.nickname,
    color: p.avatar_color,
    hat: p.hat,
    level: p.level,
    streak: streak?.current ?? 0,
    favouriteWorld: favouriteWorld(tried),
    gamesTried: tried.length,
    totalGames: shown.length,
    rank: overall === null ? null : rankFor(overall),
    minor: isUnder16(p.age_band),
    hideActivity: !!p.hide_activity,
  });
}
