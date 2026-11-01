/**
 * Offline Daily pack timing (SPZ-27b). Pure helpers, shared by lib/offline/register.ts and the tests;
 * public/sw.js repeats the small bits it needs (it can't import TypeScript).
 *
 * The server never hands out a Daily before its GMT day starts (POST /api/v1/attempts pins mode
 * "daily" to today), so the pack for a day is fetched as early as that day allows instead:
 * - a tab or installed app that is open over GMT midnight fetches it 1 to 5 minutes after midnight
 *   (spread per device so midnight isn't a stampede);
 * - a tab coming back to the foreground on a new GMT day fetches it then;
 * - every app start fetches it (the existing same-day prefetch);
 * - where the browser allows Periodic Background Sync (installed Chromium apps), the service worker
 *   fetches it in the background, so it's there even if the app isn't opened before going offline.
 * Why not tomorrow's pack today: see docs/qa/LOW_DATA.md.
 */

export const DAY_MS = 86_400_000;
/** Earliest and latest moment after GMT midnight a device fetches the new day's pack. */
export const ROLLOVER_MIN_MS = 60_000;
export const ROLLOVER_SPREAD_MS = 4 * 60_000;

/** GMT calendar day, YYYY-MM-DD (the Daily's day). */
export function gmtDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Milliseconds until the next GMT midnight (never 0: exactly at midnight it is a full day). */
export function msUntilNextGmtDay(nowMs: number): number {
  const into = ((nowMs % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - into;
}

/**
 * Delay from now until this device should fetch the next day's pack: next GMT midnight plus 1 to 5
 * minutes. `spread` in [0, 1) picks the device's slot (a stable random number per device).
 */
export function rolloverDelayMs(nowMs: number, spread: number): number {
  const s = Number.isFinite(spread) ? Math.min(Math.max(spread, 0), 0.999) : 0;
  return msUntilNextGmtDay(nowMs) + ROLLOVER_MIN_MS + Math.floor(s * ROLLOVER_SPREAD_MS);
}

/** Has this device not fetched the pack for the current GMT day yet? */
export function needsDailyPack(lastPackDay: string | null, nowMs: number): boolean {
  return lastPackDay !== gmtDay(nowMs);
}

export interface TodayGame {
  id: string;
  ready: boolean;
  state: "new" | "in_progress" | "cleared";
}

/** The games worth saving for offline: ready, not cleared yet, and one of the launch Dailies. */
export function packGames(games: TodayGame[], launchIds: readonly string[]): string[] {
  return games.filter((g) => g.ready && g.state !== "cleared" && launchIds.includes(g.id)).map((g) => g.id);
}
