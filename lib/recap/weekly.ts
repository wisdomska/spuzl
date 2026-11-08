/**
 * Weekly recap (R3-10), pure. On a player's first Home visit of a GMT week (from Monday 00:00 GMT), a card sums
 * up the week before: games cleared, best time (and in which game), streak, league result, Sparks earned.
 *
 * Computed on request from existing tables (GET /api/v1/me/weekly-recap, lib/recap/weekly.server.ts); nothing new is
 * stored about the player. "Shown this week" is remembered on the device only (localStorage['spuzl.weeklyRecap']
 * holds the Monday of the week it was shown in). The card goes through the prompt queue (`weekly_recap`) so it
 * never stacks with another prompt, and lives on Home only, never on a play screen.
 */
import { addDays } from "@/lib/admin/dates";
import { weekStartGmt } from "@/lib/format";

export type LeagueResult = "promoted" | "stayed" | "demoted";

export interface WeeklyRecap {
  /** Monday (GMT) of the week summed up, YYYY-MM-DD */
  week: string;
  /** boards cleared that week (any mode but the tutorial) */
  cleared: number;
  /** fastest clear of a timed game that week */
  best: { game: string; ms: number } | null;
  /** the streak now */
  streak: number;
  /** last week's league: the tier played in, final place and result (null when not in one) */
  league: { tier: number; rank: number | null; result: LeagueResult | null } | null;
  /** Sparks earned that week (spending not subtracted) */
  sparks: number;
}

/** The GMT week the recap shows on `now`'s visit (this week) and the week it sums up (the one before). */
export function recapWeeks(now: Date): { thisWeek: string; recapWeek: string } {
  const thisWeek = weekStartGmt(now.toISOString().slice(0, 10));
  return { thisWeek, recapWeek: addDays(thisWeek, -7) };
}

/** "3 Nov" to "9 Nov" style day and month labels for a recap week (GMT). */
export function weekLabels(week: string): { from: string; to: string } {
  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return { from: fmt(week), to: fmt(addDays(week, 6)) };
}

/** Anything worth a card: at least one clear or some Sparks earned. */
export const hasRecap = (r: WeeklyRecap | null | undefined): r is WeeklyRecap => !!r && (r.cleared > 0 || r.sparks > 0);

/** Pure: should the card want the prompt slot now? Off, already shown this week, or nothing to show: no. */
export function recapDue(o: { enabled: boolean; shownWeek: string | null; now: Date; recap: WeeklyRecap | null | undefined }): boolean {
  if (!o.enabled || !hasRecap(o.recap)) return false;
  const { thisWeek, recapWeek } = recapWeeks(o.now);
  return o.shownWeek !== thisWeek && o.recap.week === recapWeek;
}

/** Pure: the recap from the rows the server read for that week. */
export function buildRecap(i: {
  week: string;
  cleared: number;
  fastest: { game_id: string; time_ms: number } | null;
  streak: number | null;
  league: { tier: number; home_tier?: number | null; final_rank: number | null; result: string | null } | null;
  sparks: readonly { amount: number }[];
}): WeeklyRecap {
  const result = i.league?.result;
  return {
    week: i.week,
    cleared: Math.max(0, i.cleared),
    best: i.fastest && i.fastest.time_ms > 0 ? { game: i.fastest.game_id, ms: i.fastest.time_ms } : null,
    streak: Math.max(0, i.streak ?? 0),
    league: i.league
      ? {
          tier: i.league.home_tier ?? i.league.tier,
          rank: i.league.final_rank,
          result: result === "promoted" || result === "stayed" || result === "demoted" ? result : null,
        }
      : null,
    sparks: i.sparks.reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0),
  };
}

// ---------- browser ----------

export const RECAP_KEY = "spuzl.weeklyRecap";

/** The Monday of the week the recap was last shown on this device, or null (none, or storage blocked). */
export function readShownWeek(): string | null {
  try {
    return localStorage.getItem(RECAP_KEY);
  } catch {
    return null;
  }
}

/** Remembers that this week's recap has shown. Storage blocked: it may show again on a later visit this week. */
export function markShown(thisWeek: string) {
  try {
    localStorage.setItem(RECAP_KEY, thisWeek);
  } catch {
    /* private mode */
  }
}
