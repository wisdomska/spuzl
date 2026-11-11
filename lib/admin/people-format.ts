/**
 * Human formats for the admin Players area (players, reports, join requests, feedback): "2 hours ago" with the exact
 * GMT time for a tooltip, "Wed 11 Nov", "1 min 20 s", and how recently a player was active. Pure, GMT throughout.
 */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const valid = (iso: string | null | undefined): iso is string => !!iso && Number.isFinite(Date.parse(iso));

/** "Wed 11 Nov", with the year when it is not the current one ("Mon 3 Nov 2025"). */
export function dayDate(iso: string, now = Date.now()): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const year = d.getUTCFullYear() !== new Date(now).getUTCFullYear() ? ` ${d.getUTCFullYear()}` : "";
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year}`;
}

/** "Wed 11 Nov 2026, 14:05 GMT": the exact time, for tooltips and Technical details. */
export function exactTime(iso: string | null | undefined): string {
  if (!valid(iso)) return "";
  const d = new Date(iso);
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hm} GMT`;
}

/** "just now", "5 min ago", "3 hours ago", "yesterday", "4 days ago", then the date ("Wed 11 Nov"). */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!valid(iso)) return "";
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < MIN) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MIN)} min ago`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(ms / DAY);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return dayDate(iso, now);
}

/** "in 3 days", "in 5 hours", "tomorrow" (for ban ends); the date when it is further off. */
export function timeUntil(iso: string | null | undefined, now = Date.now()): string {
  if (!valid(iso)) return "";
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "any moment now";
  if (ms < HOUR) return `in ${Math.max(1, Math.round(ms / MIN))} min`;
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `in ${h} hour${h === 1 ? "" : "s"}`;
  }
  const days = Math.round(ms / DAY);
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  return `on ${dayDate(iso, now)}`;
}

/** "1 min 20 s", "45 s", "2 h 5 min". Empty for a missing duration. */
export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 60)} h`;
}

export type Activity = "now" | "today" | "week" | "month" | "quiet" | "never";

/** How recently a player was seen: playing now (5 min), today (24 h), this week, this month, quiet (30+ days), never. */
export function activityOf(lastSeen: string | null | undefined, now = Date.now()): Activity {
  if (!valid(lastSeen)) return "never";
  const ms = now - Date.parse(lastSeen);
  if (ms < 5 * MIN) return "now";
  if (ms < DAY) return "today";
  if (ms < 7 * DAY) return "week";
  if (ms < 30 * DAY) return "month";
  return "quiet";
}

/** Whole days since a timestamp (0 on the day itself). */
export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));

/** 12345 -> "12,345" */
export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
