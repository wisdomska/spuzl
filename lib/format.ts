/** mm:ss, tabular. Hours roll into minutes (Weekly Mega can exceed an hour). */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A clear's time on a result (R2-15): never "00:00". The clock starts on the first move, so a puzzle solved by that
 * move can read under a second; it shows as "00:01", and other times round up to the second they reached.
 */
export function formatClear(ms: number): string {
  return formatClock(Math.max(1000, Math.ceil(ms / 1000) * 1000));
}

/**
 * 1:12 style, for share text and share cards only (their design format). Rounds down like formatClock, so
 * a shared time never disagrees with the clock. Everything shown in the app uses formatClock.
 */
export function formatShort(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-GB");
}

/** Today's date in GMT (Daily resets 00:00 GMT). */
export function gmtDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Daily number: day count since launch (#1 = 2026-04-01, so the design's #214 lands on 2026-10-31). */
export const LAUNCH_DATE = "2026-04-01";
export function dailyNumber(date: string): number {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(LAUNCH_DATE + "T00:00:00Z")) / 86_400_000) + 1;
}

/** ms until the next 00:00 GMT */
export function msToReset(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Monday (GMT) of the week containing `date`, YYYY-MM-DD. */
export function weekStartGmt(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Daily seed for a game. Gauntlet is "new weekly" (SRS 5.8): one course per GMT week. */
export function dailySeed(gameId: string, date: string): string {
  return gameId === "gauntlet" ? `weekly:gauntlet:${weekStartGmt(date)}` : `daily:${gameId}:${date}`;
}
