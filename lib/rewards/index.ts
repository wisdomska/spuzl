/**
 * Reward maths (SRS 4.1, 4.2, 4.6). Pure functions; the server calls these after verification and
 * writes the result through svc_grant_reward, which is idempotent per (source, ref).
 */

export interface DailyClearInput {
  timeMs: number;
  hints: number;
  mistakes: number;
  deaths?: number;
  /** today's median clear time for this game; null when too few players */
  medianMs: number | null;
  firstClearOfGameEver: boolean;
  archive?: boolean;
  relaxed?: boolean;
}

export interface Reward {
  xp: number;
  sparks: number;
  lines: { label: string; xp: number; sparks?: number }[];
}

/** +10 to +40 XP, scaled by how far under the median (linear, 0% under = 10, 50%+ under = 40). */
export function speedBonus(timeMs: number, medianMs: number | null): number {
  if (!medianMs || timeMs >= medianMs) return 0;
  const under = Math.min(0.5, (medianMs - timeMs) / medianMs);
  return Math.round(10 + (under / 0.5) * 30);
}

export function dailyClearReward(i: DailyClearInput): Reward {
  const lines: Reward["lines"] = [{ label: "Daily clear", xp: 50, sparks: 5 }];
  if (i.hints === 0) lines.push({ label: "No hints", xp: 25, sparks: 10 });
  if (i.mistakes === 0 && !(i.deaths && i.deaths > 0)) lines.push({ label: "Perfect", xp: 20, sparks: 10 });
  const speed = i.relaxed ? 0 : speedBonus(i.timeMs, i.medianMs);
  if (speed) lines.push({ label: "Speed", xp: speed });
  if (i.firstClearOfGameEver) lines.push({ label: "First clear of a new game", xp: 100 });
  let xp = lines.reduce((s, l) => s + l.xp, 0);
  let sparks = lines.reduce((s, l) => s + (l.sparks ?? 0), 0);
  if (i.hints > 0) {
    xp = Math.floor(xp / 2); // hint-used clears are halved
    lines.push({ label: "Hints used, halved", xp: -Math.ceil(lines.reduce((s, l) => s + l.xp, 0) / 2) });
  }
  if (i.archive) {
    xp = Math.floor(xp / 2);
    sparks = 0;
  }
  return { xp, sparks, lines };
}

/** Free play (design: +10 XP, +5 Sparks), capped at 300 XP per day; duplicate seeds earn nothing. */
export const FREE_XP = 10;
export const FREE_SPARKS = 5;
export const FREE_XP_DAILY_CAP = 300;
export function freePlayReward(xpEarnedToday: number, duplicateSeed: boolean): Reward {
  if (duplicateSeed) return { xp: 0, sparks: 0, lines: [] };
  const xp = Math.max(0, Math.min(FREE_XP, FREE_XP_DAILY_CAP - xpEarnedToday));
  return { xp, sparks: xp > 0 ? FREE_SPARKS : 0, lines: [{ label: "Free play clear", xp, sparks: xp > 0 ? FREE_SPARKS : 0 }] };
}

export const FULL_SPUZL = { xp: 150, sparks: 25 };
export const DUEL = { winXp: 40, lossXp: 10 };
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;
export const STREAK_MILESTONE_SPARKS: Record<number, number> = { 3: 10, 7: 25, 14: 40, 30: 75, 50: 100, 100: 200, 365: 500 };
export const FREEZE_PRICE = 200;

/** Level n → n+1 needs 100 × n^1.4 XP, rounded to 10 (matches public.level_for_xp). */
export function xpForLevel(n: number): number {
  return Math.round((100 * Math.pow(n, 1.4)) / 10) * 10;
}

export interface LevelProgress {
  level: number;
  into: number;
  need: number;
}
export function levelFromXp(total: number): LevelProgress {
  let level = 1;
  let rest = Math.max(0, Math.floor(total));
  for (;;) {
    const need = xpForLevel(level);
    if (rest < need) return { level, into: rest, need };
    rest -= need;
    level++;
  }
}

/** Flame colour by streak (SRS 4.5: orange, blue, purple, prism). */
export function flameTier(streak: number): "orange" | "blue" | "purple" | "prism" {
  if (streak >= 100) return "prism";
  if (streak >= 30) return "purple";
  if (streak >= 7) return "blue";
  return "orange";
}

/** League ladder (SRS 4.4). */
export const LEAGUE_TIERS = ["Bronze Block", "Silver Gear", "Gold Crown", "Neon Prism", "Cosmic Spuz"] as const;
export const LEAGUE_REWARD_SPARKS = [20, 40, 70, 100, 150] as const;
