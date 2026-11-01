import "server-only";
import { SOLO_MODES } from "@/lib/gamification/progress";
import { getGameSettings } from "@/lib/game-settings/server";

const DAILY_ONLY_FAMILIES = ["speed", "fullspuzl"];
import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGES } from "@/lib/gamification/badges";
import { GAME_BY_ID, WORLDS, type WorldId } from "@/lib/catalog";
import { rankFor } from "@/lib/rating/glicko2";
import { FAMILY_LABEL, badgeFamilies, badgeProgress, type BadgeStats } from "./index";
import { friendIds } from "@/lib/social/server";

export interface GameStat {
  game: string;
  clears: number;
  bestMs: number | null;
  avgMs: number | null;
  bestScore: number | null;
}

export async function gameStats(admin: SupabaseClient, playerId: string): Promise<GameStat[]> {
  const { data, error } = await admin.rpc("svc_player_game_stats", { p: playerId });
  if (error) throw error;
  return ((data ?? []) as { game_id: string; clears: number; best_ms: number | null; avg_ms: number | null; best_score: number | null }[])
    .filter((r) => GAME_BY_ID[r.game_id])
    .map((r) => ({ game: r.game_id, clears: r.clears, bestMs: r.best_ms, avgMs: r.avg_ms, bestScore: r.best_score }))
    .sort((a, b) => b.clears - a.clears || a.game.localeCompare(b.game));
}

/** Badges grouped by family with tiers, earned state and progress. Secret badges only once earned. */
export async function badgeOverview(admin: SupabaseClient, playerId: string, games?: GameStat[]) {
  const stats = games ?? (await gameStats(admin, playerId));
  const head = { count: "exact" as const, head: true };
  const [{ data: owned }, { count: noHint }, { count: daily }, { count: fs }, { data: streak }, friends] = await Promise.all([
    admin.from("player_badges").select("badge_id, earned_at").eq("player_id", playerId),
    admin.from("attempts").select("id", head).eq("player_id", playerId).eq("status", "cleared").in("mode", SOLO_MODES).eq("hints", 0),
    admin.from("attempts").select("id", head).eq("player_id", playerId).eq("status", "cleared").in("mode", SOLO_MODES),
    admin.from("xp_ledger").select("id", head).eq("player_id", playerId).eq("source", "full_spuzl"),
    admin.from("streaks").select("best, current").eq("player_id", playerId).maybeSingle(),
    friendIds(admin, playerId),
  ]);
  const worldCleared: Partial<Record<WorldId, number>> = {};
  for (const s of stats) {
    const w = GAME_BY_ID[s.game].world;
    worldCleared[w] = (worldCleared[w] ?? 0) + 1;
  }
  const bs: BadgeStats = {
    clears: stats.reduce((n, s) => n + s.clears, 0),
    dailyClears: daily ?? 0,
    noHintClears: noHint ?? 0,
    fullSpuzlDays: fs ?? 0,
    bestStreak: Math.max(streak?.best ?? 0, streak?.current ?? 0),
    friends: friends.length,
    worldCleared,
    gameClears: Object.fromEntries(stats.map((s) => [s.game, s.clears])),
  };
  const earnedAt = new Map((owned ?? []).map((o) => [o.badge_id as string, o.earned_at as string]));
  // Dailies off: the families only Dailies can earn (median speed, Full Spuzl) are hidden unless already earned.
  const dailiesOn = (await getGameSettings())["features.dailies"];
  const shownBadges = dailiesOn ? BADGES : BADGES.filter((b) => !DAILY_ONLY_FAMILIES.includes(b.family) || earnedAt.has(b.id));
  const families = badgeFamilies(shownBadges, new Set(earnedAt.keys())).map((f) => ({
    family: f.family,
    label: FAMILY_LABEL[f.family] ?? f.family,
    badges: f.badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      tier: b.tier,
      icon: b.icon,
      secret: !!b.secret,
      earned: earnedAt.has(b.id),
      earnedAt: earnedAt.get(b.id) ?? null,
      progress: earnedAt.has(b.id) ? null : badgeProgress(b, bs),
    })),
  }));
  return {
    families,
    earned: earnedAt.size,
    total: shownBadges.filter((b) => !b.secret).length,
    secretsLeft: BADGES.filter((b) => b.secret && !earnedAt.has(b.id)).length,
    stats: bs,
  };
}

/** Rank per world from Glicko-2 ratings (lib/rating/glicko2 rankFor). Unplayed worlds are locked. */
export async function worldRanks(admin: SupabaseClient, playerId: string) {
  const { data, error } = await admin.from("ratings").select("track, rating, games").eq("player_id", playerId);
  if (error) throw error;
  const by = new Map((data ?? []).map((r) => [r.track as string, r as { rating: number; games: number }]));
  return {
    worlds: WORLDS.map((w) => {
      const r = by.get(w.id);
      const played = !!r && Number(r.games) > 0;
      const rating = played ? Number(r!.rating) : null;
      return { world: w.id, rating, rank: rating === null ? null : rankFor(rating) };
    }),
    duel: by.has("duel") ? Number(by.get("duel")!.rating) : null,
  };
}
