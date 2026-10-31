/**
 * Meta-screen rules: badge progress, quest periods, archive calendar, School Cup, leaderboard scopes, shop.
 * Pure functions only (unit tested in lib/meta/meta.test.ts).
 */
import { GAMES, WORLD_BY_ID, gamesInWorld, type GameMeta, type WorldId } from "@/lib/catalog";
import type { BadgeDef } from "@/lib/gamification/badges";
import type { QuestDef } from "@/lib/gamification/quests";

// ---------- leaderboards ----------
export const SCOPES = ["friends", "crew", "school", "city", "country", "global"] as const;
export type Scope = (typeof SCOPES)[number];
export const SCOPE_LABEL: Record<Scope, string> = {
  friends: "Friends",
  crew: "Crew",
  school: "School",
  city: "City",
  country: "Country",
  global: "Global",
};

/** "top 8%" for the pinned row: share of the board at or above you, rounded up, at least 1. */
export function topPercent(pos: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(1, Math.min(100, Math.ceil((pos / total) * 100)));
}

// ---------- badges ----------
export interface BadgeStats {
  clears: number;
  dailyClears: number;
  noHintClears: number;
  fullSpuzlDays: number;
  bestStreak: number;
  friends: number;
  /** distinct games cleared per world */
  worldCleared: Partial<Record<WorldId, number>>;
  gameClears: Record<string, number>;
}

/** Progress toward a badge, or null when it can't be measured as a count (shown as locked). */
export function badgeProgress(b: BadgeDef, s: BadgeStats): { have: number; need: number } | null {
  const n = b.rule.n ?? 1;
  switch (b.rule.kind) {
    case "clears":
      return { have: Math.min(n, s.clears), need: n };
    case "streak":
      return { have: Math.min(n, s.bestStreak), need: n };
    case "no_hint_clears":
      return { have: Math.min(n, s.noHintClears), need: n };
    case "full_spuzl_days":
      return { have: Math.min(n, s.fullSpuzlDays), need: n };
    case "friends":
      return { have: Math.min(n, s.friends), need: n };
    case "world_all": {
      const w = b.rule.world as WorldId;
      const need = gamesInWorld(w).length;
      return { have: Math.min(need, s.worldCleared[w] ?? 0), need };
    }
    case "game_clears":
      return { have: Math.min(n, s.gameClears[b.rule.game ?? ""] ?? 0), need: n };
    default:
      return null;
  }
}

/** Badge families in display order, with secret badges hidden unless earned. */
export function badgeFamilies(badges: BadgeDef[], earned: Set<string>): { family: string; badges: BadgeDef[] }[] {
  const order: string[] = [];
  const by = new Map<string, BadgeDef[]>();
  for (const b of badges) {
    if (b.secret && !earned.has(b.id)) continue;
    if (!by.has(b.family)) {
      by.set(b.family, []);
      order.push(b.family);
    }
    by.get(b.family)!.push(b);
  }
  return order.map((family) => ({ family, badges: by.get(family)! }));
}

export const FAMILY_LABEL: Record<string, string> = {
  starter: "Starter",
  explorer: "World Explorer",
  streak: "Streak",
  speed: "Speed Demon",
  clean: "Clean Hands",
  fullspuzl: "Full Spuzl",
  rage: "Rage Survivor",
  social: "Social",
  duel: "Duel",
  party: "Party",
  board: "Board Bay",
  time: "Night Owl and Early Bird",
  secret: "Secret",
};

// ---------- quests ----------
const QUEST_ICON: Record<string, string> = {
  daily_clears: "check-circle",
  no_hint_clears: "hand-palm",
  beat_friend: "timer",
  duels: "sword",
  free_clears: "infinity",
  worlds_today: "map-trifold",
  mp_wins: "trophy",
  worlds_week: "map-trifold",
  full_spuzl_days: "crown",
  streak: "fire",
};

export function questIcon(q: QuestDef): string {
  if (q.goal.kind === "world_clears" && q.goal.world) return WORLD_BY_ID[q.goal.world as WorldId]?.icon ?? "flask";
  return QUEST_ICON[q.goal.kind] ?? "star";
}

/** Weekly chain step state: done (claimed or completed), current (first not done), locked. */
export function chainStates(steps: { completed: boolean }[]): ("done" | "current" | "locked")[] {
  let foundCurrent = false;
  return steps.map((s) => {
    if (s.completed) return "done";
    if (!foundCurrent) {
      foundCurrent = true;
      return "current";
    }
    return "locked";
  });
}

// ---------- archive ----------
export const ARCHIVE_FREE_DAYS = 7;

export type ArchiveDayState = "cleared" | "started" | "missed" | "today" | "future" | "locked" | "none";

/** Whether a past date is free to replay (the last 7 days), locked behind SPUZL+, or not playable. */
export function archiveAccess(date: string, today: string, launch: string): "free" | "locked" | "today" | "future" | "before" {
  if (date < launch) return "before";
  if (date === today) return "today";
  if (date > today) return "future";
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  return days <= ARCHIVE_FREE_DAYS ? "free" : "locked";
}

/** Month grid, Monday first: leading nulls then ISO dates. */
export function monthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const out: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) out.push(new Date(Date.UTC(year, month0, d)).toISOString().slice(0, 10));
  return out;
}

/** "Mon 27 Oct" */
export function shortDate(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
}

// ---------- School Cup ----------
/** Classroom mode hides Rage Ridge and photosensitive games (T1: "Hidden in classroom mode"). */
export function classroomAllowed(g: GameMeta): boolean {
  return g.world !== "rage" && !g.photosensitive;
}
export const CLASSROOM_GAMES = GAMES.filter(classroomAllowed);
export const MAX_CUP_GAMES = 5;

/** A run starts on a Monday, this week or later, and ends within its week. */
export function validRun(weekStart: string, endsOn: string, today: string): string | null {
  const ws = new Date(weekStart + "T00:00:00Z");
  if (Number.isNaN(ws.getTime()) || ws.getUTCDay() !== 1) return "The run starts on a Monday.";
  const thisMonday = new Date(today + "T00:00:00Z");
  thisMonday.setUTCDate(thisMonday.getUTCDate() - ((thisMonday.getUTCDay() + 6) % 7));
  if (ws < thisMonday) return "Pick this week or a later one.";
  const span = Math.round((Date.parse(endsOn) - ws.getTime()) / 86_400_000);
  if (!(span >= 0 && span <= 6)) return "The run ends within its week.";
  return null;
}

/** Next Monday on or after a date. */
export function nextMonday(today: string): string {
  const d = new Date(today + "T00:00:00Z");
  const add = (8 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- shop ----------
export const SHOP_TABS = [
  { id: "hat", label: "Hats" },
  { id: "skin", label: "Skins" },
  { id: "board_theme", label: "Boards" },
  { id: "title", label: "Titles" },
  { id: "extra", label: "Extras" },
] as const;
export type ShopTab = (typeof SHOP_TABS)[number]["id"];

export const tabOf = (type: string): ShopTab => (type === "freeze" || type === "hint_pack" ? "extra" : (type as ShopTab));

export interface ShopItemState {
  price: number;
  owned: boolean;
  unlockLevel: number | null;
  consumable: boolean;
}

/** What the buy button can do for an item. */
export function purchaseState(
  item: ShopItemState,
  sparks: number,
  level: number,
  freezesHeld = 0,
  isFreeze = false,
): { kind: "owned" | "locked" | "full" | "short" | "free" | "buy"; short?: number } {
  if (item.owned && !item.consumable) return { kind: "owned" };
  if (item.unlockLevel !== null && level < item.unlockLevel) return { kind: "locked" };
  if (isFreeze && freezesHeld >= 2) return { kind: "full" };
  if (item.price === 0) return { kind: "free" };
  if (sparks < item.price) return { kind: "short", short: item.price - sparks };
  return { kind: "buy" };
}
