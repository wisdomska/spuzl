import { LAUNCH_IDS } from "@/lib/catalog";
import { gmtDay, needsDailyPack, packGames, rolloverDelayMs, type TodayGame } from "./daily-pack";

/**
 * Service worker registration and today's Dailies prefetch. Called from instrumentation-client.ts, so
 * it runs on every page without a component. Production only: in `next dev` the Turbopack chunks are
 * not content-hashed, so a cache-first worker would serve stale code (set NEXT_PUBLIC_SW_DEV=1 to try it).
 */
const PREFETCH_KEY = "spuzl.prefetch";
const SLOT_KEY = "spuzl.packSlot";
const PACK_TAG = "spuzl-daily-pack";
const PACK_INTERVAL_MS = 12 * 3_600_000;

export function swEnabled(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  return process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1";
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!swEnabled()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch (e) {
    console.warn("[sw] registration failed", e);
    return null;
  }
}

interface TodayRes {
  dailies?: boolean;
  date: string;
  games: TodayGame[];
}

/**
 * Prefetches today's featured Dailies through the worker so they open offline: one start request per
 * ready, uncleared launch game (the worker caches the response per GMT day). Runs at most once per day
 * per device and only for a signed-in player with a profile.
 *
 * Note: starting an attempt records `started_at`; the Daily resumes from it when the player opens it.
 */
export async function prefetchDailies(): Promise<number> {
  if (!swEnabled() || !navigator.onLine) return 0;
  const reg = await navigator.serviceWorker.ready;
  if (!reg.active || !navigator.serviceWorker.controller) return 0; // the worker must see the requests
  let today: TodayRes;
  try {
    const r = await fetch("/api/v1/today", { credentials: "same-origin" });
    if (!r.ok) return 0;
    today = (await r.json()) as TodayRes;
  } catch {
    return 0;
  }
  try {
    if (localStorage.getItem(PREFETCH_KEY) === today.date) return 0;
  } catch {
    /* storage blocked: prefetch anyway, the worker dedupes per day */
  }
  // Nobody signed in yet (first run), or Dailies switched off: nothing to prefetch, and no 401/404s in the console.
  if ((today as { signedIn?: boolean }).signedIn === false || today.dailies === false) return 0;
  const todo = packGames(today.games, LAUNCH_IDS);
  let saved = 0;
  for (const game of todo) {
    try {
      const r = await fetch("/api/v1/attempts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, mode: "daily" }),
      });
      if (r.status === 401 || r.status === 403 || (r.status === 409 && (await r.clone().json()).error === "no_profile")) return saved;
      if (r.ok) saved++;
    } catch {
      return saved;
    }
  }
  try {
    localStorage.setItem(PREFETCH_KEY, today.date);
  } catch {
    /* ignore */
  }
  return saved;
}

/** Low-data mode (live, from <html data-low-data>) or the browser's Save-Data: no background downloads. */
export function backgroundDownloadsOff(): boolean {
  if (typeof document === "undefined") return true;
  return (
    document.documentElement.dataset.lowData === "true" ||
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  );
}

function lastPackDay(): string | null {
  try {
    return localStorage.getItem(PREFETCH_KEY);
  } catch {
    return null;
  }
}

/** A stable random slot in [0, 1) per device, so devices spread their after-midnight fetch. */
function packSlot(): number {
  try {
    const raw = localStorage.getItem(SLOT_KEY);
    const v = Number(raw);
    if (raw !== null && v >= 0 && v < 1) return v;
    const n = Math.random();
    localStorage.setItem(SLOT_KEY, String(n));
    return n;
  } catch {
    return Math.random();
  }
}

/**
 * SPZ-27b: keeps the offline Daily pack current while the app stays open. Fetches the new day's pack
 * 1 to 5 minutes after GMT midnight, and when the tab returns (or the connection does) on a GMT day
 * it hasn't been fetched for yet. Never before the day starts: the server only serves today's Daily
 * (docs/qa/LOW_DATA.md). Tries at most once per day per page (a signed-out player has no pack).
 * Returns a stop function.
 */
export function scheduleDailyPack(): () => void {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tried: string | null = null;
  const run = () => {
    if (backgroundDownloadsOff() || !navigator.onLine) return;
    const now = Date.now();
    if (!needsDailyPack(lastPackDay(), now) || !needsDailyPack(tried, now)) return;
    tried = gmtDay(now);
    void prefetchDailies().catch(() => 0);
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        run();
        arm();
      },
      rolloverDelayMs(Date.now(), packSlot()),
    );
  };
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    run();
    arm(); // timers stall while the device sleeps: re-aim at the next midnight
  };
  arm();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", run);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", run);
  };
}

type PeriodicSyncReg = ServiceWorkerRegistration & {
  periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void>; unregister: (tag: string) => Promise<void> };
};

/**
 * Tells the worker which Dailies make the pack and whether background downloads are allowed, and
 * (un)registers Periodic Background Sync where the browser offers it (installed Chromium apps only;
 * elsewhere this is a no-op and the in-app schedule above does the work).
 */
export async function configureDailyPack(enabled: boolean): Promise<void> {
  if (!swEnabled()) return;
  try {
    const reg = (await navigator.serviceWorker.ready) as PeriodicSyncReg;
    reg.active?.postMessage({ type: "daily-pack", enabled, games: LAUNCH_IDS });
    if (!reg.periodicSync) return;
    if (!enabled) {
      await reg.periodicSync.unregister(PACK_TAG).catch(() => undefined);
      return;
    }
    const perm = await navigator.permissions?.query({ name: "periodic-background-sync" as PermissionName }).catch(() => null);
    if (perm?.state === "granted") await reg.periodicSync.register(PACK_TAG, { minInterval: PACK_INTERVAL_MS });
  } catch {
    /* optional: the in-app schedule still runs */
  }
}

/** Forget cached Dailies and profile data (call on sign-out). */
export async function clearOfflineUserData() {
  try {
    localStorage.removeItem(PREFETCH_KEY);
  } catch {
    /* ignore */
  }
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.active?.postMessage({ type: "clear-user-data" });
}
