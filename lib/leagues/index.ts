/**
 * Weekly leagues (SRS 4.4): groups of 30, top 7 promote, bottom 5 demote, others stay.
 * Mirrors private.league_rollover so the table can show zones before the week ends.
 */
import { LEAGUE_REWARD_SPARKS, LEAGUE_TIERS } from "@/lib/rewards";

export const LEAGUE_SIZE = 30;
export const PROMOTE = 7;
export const DEMOTE = 5;
export const TOP_TIER = LEAGUE_TIERS.length - 1;

export type Zone = "promote" | "stay" | "demote";
export type LeagueResult = "promoted" | "stayed" | "demoted";

/** Zone for a 1-based rank in a group of n at a tier. Matches the rollover (no demotion under 13 players). */
export function zoneFor(rank: number, n: number, tier: number): Zone {
  if (rank <= PROMOTE && tier < TOP_TIER) return "promote";
  if (rank > n - DEMOTE && n > 12 && tier > 0) return "demote";
  return "stay";
}

export interface TierMeta {
  name: string;
  /** emblem fill */
  color: string;
  icon: string;
}

/** League emblems (Components file, Player and social): Bronze Block .. Cosmic Spuz. */
export const TIER_META: TierMeta[] = [
  { name: LEAGUE_TIERS[0], color: "var(--tier-bronze)", icon: "cube" },
  { name: LEAGUE_TIERS[1], color: "var(--tier-silver)", icon: "gear-six" },
  { name: LEAGUE_TIERS[2], color: "var(--tier-gold)", icon: "crown-simple" },
  { name: LEAGUE_TIERS[3], color: "var(--w-line)", icon: "diamond" },
  { name: LEAGUE_TIERS[4], color: "var(--tier-prism)", icon: "planet" },
];

export function tierMeta(tier: number): TierMeta {
  return TIER_META[Math.max(0, Math.min(TOP_TIER, tier))];
}

/** Sparks for the week-end ceremony. Promoted: the new tier's reward. Stayed: half this tier's. Demoted: none. */
export function leagueReward(result: LeagueResult, tier: number): number {
  const t = Math.max(0, Math.min(TOP_TIER, tier));
  if (result === "promoted") return LEAGUE_REWARD_SPARKS[Math.min(TOP_TIER, t + 1)];
  if (result === "stayed") return Math.floor(LEAGUE_REWARD_SPARKS[t] / 2);
  return 0;
}

/** Tier after the ceremony. */
export function nextTier(result: LeagueResult, tier: number): number {
  return Math.max(0, Math.min(TOP_TIER, tier + (result === "promoted" ? 1 : result === "demoted" ? -1 : 0)));
}

/** Monday 00:00 GMT of the week containing d. */
export function weekStartOf(d: Date = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/** ms until the league resets (next Monday 00:00 GMT). */
export function msToLeagueReset(now: Date = new Date()): number {
  const start = Date.parse(weekStartOf(now) + "T00:00:00Z");
  return start + 7 * 86_400_000 - now.getTime();
}

/** "2d 14h", "5h 12m", "9m" */
export function formatLeft(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${m}m`;
}

/** ISO week number (league weeks are numbered for the ceremony: "Week 43 is done"). */
export function isoWeek(date: string): number {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
