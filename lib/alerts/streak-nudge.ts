/**
 * Streak-at-risk nudge (R3-09), pure. Who gets the evening push, and what it says.
 *
 * The database picks the candidates (`svc_streak_nudge_candidates`): alerts on (a push subscription), streak at
 * least `streakNudge.minStreak`, last clear yesterday GMT (so today's clear is still missing and the streak ends
 * at the midnight GMT rollover), not nudged today, the player's "Streak reminders" switch on, never banned or test
 * players. Here, per candidate:
 * - the player's local hour, from the country the app already stores (`players.country`, ISO 3166 alpha-2);
 *   unknown or none: GMT;
 * - it must be the send hour (`streakNudge.hour`), or the hour after it when a run was missed;
 * - never in quiet hours (`alerts.quietStart` to `alerts.quietEnd`, local); under-16s start quiet hours earlier
 *   (`alerts.quietStartUnder16`). Under-16s otherwise follow the same rule as every alert: only with alerts on.
 */
import type { GameSettings } from "@/lib/game-settings/schema";
import { streakNudgeCopy as T } from "@/lib/copy/streak-nudge";

/** One time zone per country, its most populous one (good enough for an evening reminder). */
export const COUNTRY_TZ: Readonly<Record<string, string>> = {
  GH: "Africa/Accra",
  NG: "Africa/Lagos",
  CI: "Africa/Abidjan",
  TG: "Africa/Lome",
  BJ: "Africa/Porto-Novo",
  BF: "Africa/Ouagadougou",
  SN: "Africa/Dakar",
  GM: "Africa/Banjul",
  SL: "Africa/Freetown",
  LR: "Africa/Monrovia",
  GN: "Africa/Conakry",
  ML: "Africa/Bamako",
  NE: "Africa/Niamey",
  CM: "Africa/Douala",
  KE: "Africa/Nairobi",
  UG: "Africa/Kampala",
  TZ: "Africa/Dar_es_Salaam",
  RW: "Africa/Kigali",
  ET: "Africa/Addis_Ababa",
  ZA: "Africa/Johannesburg",
  ZM: "Africa/Lusaka",
  ZW: "Africa/Harare",
  EG: "Africa/Cairo",
  MA: "Africa/Casablanca",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  US: "America/New_York",
  CA: "America/Toronto",
  BR: "America/Sao_Paulo",
  AE: "Asia/Dubai",
  IN: "Asia/Kolkata",
  CN: "Asia/Shanghai",
  JP: "Asia/Tokyo",
  AU: "Australia/Sydney",
};

/** The IANA zone for a stored country code; GMT when unknown or missing. */
export const zoneFor = (country: string | null | undefined): string => COUNTRY_TZ[(country ?? "").toUpperCase()] ?? "UTC";

/** The local hour (0-23) in a country at `now`. */
export function localHour(country: string | null | undefined, now: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: zoneFor(country) }).format(now);
  return Number(h) % 24;
}

/** Whether `hour` is inside quiet hours that start at `start` and end at `end` (exclusive), wrapping midnight. */
export function inQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export interface NudgeCandidate {
  player_id: string;
  country: string | null;
  /** effective age band (lib/age effectiveBand) */
  band: string;
  streak: number;
  freezes: number;
}

export type NudgeSettings = Pick<
  GameSettings,
  | "streakNudge.enabled"
  | "streakNudge.hour"
  | "streakNudge.minStreak"
  | "alerts.quietStart"
  | "alerts.quietEnd"
  | "alerts.quietStartUnder16"
>;

/** How many hours after the send hour a missed run may still send (the cron runs hourly; one run can slip). */
export const CATCH_UP_HOURS = 1;

export type NudgeVerdict = "send" | "off" | "short_streak" | "not_yet" | "quiet";

/** Pure: should this candidate get the nudge on this run? */
export function nudgeVerdict(c: NudgeCandidate, s: NudgeSettings, now: Date): NudgeVerdict {
  if (!s["streakNudge.enabled"]) return "off";
  if (c.streak < Math.max(2, s["streakNudge.minStreak"])) return "short_streak";
  const hour = localHour(c.country, now);
  const since = (hour - s["streakNudge.hour"] + 24) % 24;
  if (since > CATCH_UP_HOURS) return "not_yet";
  const quietStart = c.band === "13-15" ? Math.min(s["alerts.quietStart"], s["alerts.quietStartUnder16"]) : s["alerts.quietStart"];
  if (inQuietHours(hour, quietStart, s["alerts.quietEnd"])) return "quiet";
  return "send";
}

/** The push itself: opens Home (Continue is one tap from there); one per day, so a fixed tag replaces any older one. */
export function nudgeMessage(streak: number, freezes: number) {
  return {
    title: T.push.title(streak),
    body: freezes > 0 ? T.push.bodyFreeze(streak) : T.push.body(streak),
    url: "/",
    tag: "streak-nudge",
  };
}
