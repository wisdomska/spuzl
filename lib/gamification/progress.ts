import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGES, type BadgeDef } from "./badges";
import { questsForDate, WEEKLY_CHAIN, type QuestDef } from "./quests";
import { advanceEventQuest } from "@/lib/events/server";

/**
 * Solo clears that count for quests, badges and streak-style goals. Dailies are off for now, so a free-play clear
 * counts wherever a Daily clear did (the copy says "clear", not "Daily").
 */
export const SOLO_MODES = ["daily", "free", "archive"];
const isSolo = (mode: string) => SOLO_MODES.includes(mode);
import { gamesInWorld, type WorldId } from "@/lib/catalog";

export interface ClearContext {
  gameId: string;
  world: WorldId;
  mode: string;
  timeMs: number;
  hints: number;
  mistakes: number;
  deaths: number;
  date: string | null;
  localHour?: number;
  fullSpuzl: boolean;
  streak: number;
}

export type Unlock =
  | { type: "badge"; id: string; name: string; tier: BadgeDef["tier"]; icon: string; sparks: number; secret: boolean }
  | { type: "quest"; id: string; title: string };

interface Stats {
  clears: number;
  dailyClears: number;
  noHintClears: number;
  fullSpuzlDays: number;
  gameClears: (game: string) => Promise<number>;
  worldGamesCleared: (world: WorldId) => Promise<number>;
}

async function stats(admin: SupabaseClient, playerId: string): Promise<Stats> {
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const base = () => admin.from("attempts").select("id", { count: "exact", head: true }).eq("player_id", playerId).eq("status", "cleared");
  const [clears, dailyClears, noHintClears] = await Promise.all([
    count(base()),
    count(base().in("mode", SOLO_MODES)),
    count(base().in("mode", SOLO_MODES).eq("hints", 0)),
  ]);
  const { count: fs } = await admin
    .from("xp_ledger")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("source", "full_spuzl");
  return {
    clears,
    dailyClears,
    noHintClears,
    fullSpuzlDays: fs ?? 0,
    gameClears: async (game) => count(base().eq("game_id", game)),
    worldGamesCleared: async (world) => {
      const ids = gamesInWorld(world).map((g) => g.id);
      const { data } = await admin.from("attempts").select("game_id").eq("player_id", playerId).eq("status", "cleared").in("game_id", ids);
      return new Set((data ?? []).map((r) => r.game_id)).size;
    },
  };
}

async function badgeEarned(b: BadgeDef, c: ClearContext, s: Stats): Promise<boolean> {
  const n = b.rule.n ?? 1;
  // The 4 × 4 tutorial only ever earns First Clear.
  if (c.mode === "tutorial") return b.rule.kind === "clears" && s.clears >= n;
  switch (b.rule.kind) {
    case "clears":
      return s.clears >= n;
    case "streak":
      return c.streak >= n;
    case "no_hint_clears":
      return s.noHintClears >= n;
    case "full_spuzl_days":
      return s.fullSpuzlDays >= n;
    case "game_clears":
      return c.gameId === b.rule.game && (await s.gameClears(b.rule.game!)) >= n;
    case "world_all":
      return c.world === b.rule.world && (await s.worldGamesCleared(c.world)) >= gamesInWorld(c.world).length;
    case "under_ms":
      return c.timeMs < n;
    case "night_owl":
      return isSolo(c.mode) && c.localHour !== undefined && c.localHour >= 0 && c.localHour < 4;
    case "early_bird":
      return isSolo(c.mode) && c.localHour !== undefined && c.localHour >= 4 && c.localHour < 6;
    case "last_minute": {
      const now = new Date();
      return isSolo(c.mode) && now.getUTCHours() === 23 && now.getUTCMinutes() === 59;
    }
    case "zero_deaths":
      return c.world === "rage" && c.deaths === 0;
    case "gauntlet_deaths":
      return c.gameId === "gauntlet" && c.deaths <= n;
    default:
      return false; // social, duel and party badges are evaluated where those events happen
  }
}

/** Awards newly earned badges (with Sparks) and advances quests. Returns what to celebrate. */
export async function evaluateAfterClear(admin: SupabaseClient, playerId: string, c: ClearContext): Promise<Unlock[]> {
  const unlocks: Unlock[] = [];
  const { data: owned } = await admin.from("player_badges").select("badge_id").eq("player_id", playerId);
  const have = new Set((owned ?? []).map((r) => r.badge_id));
  const s = await stats(admin, playerId);
  for (const b of BADGES) {
    if (have.has(b.id)) continue;
    if (!(await badgeEarned(b, c, s))) continue;
    const { error } = await admin.from("player_badges").insert({ player_id: playerId, badge_id: b.id });
    if (error) continue;
    await admin.rpc("svc_grant_reward", { p_player: playerId, p_source: "badge", p_ref: b.id, p_xp: 0, p_sparks: b.sparks });
    unlocks.push({ type: "badge", id: b.id, name: b.name, tier: b.tier, icon: b.icon, sparks: b.sparks, secret: !!b.secret });
  }
  unlocks.push(...(await advanceQuests(admin, playerId, c)));
  // Seasonal event bonus quest (features.seasonal): free-play clears only; a failure never blocks the clear.
  const ev = await advanceEventQuest(admin, playerId, c).catch((e) => {
    console.error("[events]", e);
    return null;
  });
  if (ev) unlocks.push({ type: "quest", id: ev.id, title: ev.title });
  return unlocks;
}

export function weekStart(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

function questDelta(q: QuestDef, c: ClearContext): number {
  switch (q.goal.kind) {
    case "world_clears":
      return isSolo(c.mode) && c.world === q.goal.world ? 1 : 0;
    case "daily_clears":
      return isSolo(c.mode) ? 1 : 0;
    case "no_hint_clears":
      return isSolo(c.mode) && c.hints === 0 ? 1 : 0;
    case "free_clears":
      return c.mode === "free" ? 1 : 0;
    case "full_spuzl_days":
      return c.fullSpuzl ? 1 : 0;
    default:
      return 0;
  }
}

async function advanceQuests(admin: SupabaseClient, playerId: string, c: ClearContext): Promise<Unlock[]> {
  const today = new Date().toISOString().slice(0, 10);
  const week = weekStart();
  const out: Unlock[] = [];
  const list: [QuestDef, string][] = [
    ...questsForDate(today).map((q) => [q, today] as [QuestDef, string]),
    ...WEEKLY_CHAIN.map((q) => [q, week] as [QuestDef, string]),
  ];
  for (const [q, period] of list) {
    let delta = questDelta(q, c);
    if (q.goal.kind === "streak") delta = c.streak >= q.goal.n ? q.goal.n : 0;
    if (!delta) continue;
    const { data: row } = await admin
      .from("player_quests")
      .select("progress, completed_at")
      .eq("player_id", playerId)
      .eq("quest_id", q.id)
      .eq("period", period)
      .maybeSingle();
    if (row?.completed_at) continue;
    // Weekly chain is sequential: step n only advances once step n-1 is complete.
    if (q.kind === "weekly" && q.step && q.step > 1) {
      const prev = WEEKLY_CHAIN[q.step - 2];
      const { data: p } = await admin
        .from("player_quests")
        .select("completed_at")
        .eq("player_id", playerId)
        .eq("quest_id", prev.id)
        .eq("period", period)
        .maybeSingle();
      if (!p?.completed_at) continue;
    }
    const progress = q.goal.kind === "streak" ? delta : Math.min(q.goal.n, (row?.progress ?? 0) + delta);
    const done = progress >= q.goal.n;
    await admin.from("player_quests").upsert({
      player_id: playerId,
      quest_id: q.id,
      period,
      progress,
      target: q.goal.n,
      completed_at: done ? new Date().toISOString() : null,
    });
    if (done) out.push({ type: "quest", id: q.id, title: q.title });
  }
  return out;
}
