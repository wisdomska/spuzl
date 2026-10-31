import { LAUNCH_IDS } from "@/lib/catalog";

/**
 * Service worker registration and today's Dailies prefetch. Called from instrumentation-client.ts, so
 * it runs on every page without a component. Production only: in `next dev` the Turbopack chunks are
 * not content-hashed, so a cache-first worker would serve stale code (set NEXT_PUBLIC_SW_DEV=1 to try it).
 */
const PREFETCH_KEY = "spuzl.prefetch";

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
  date: string;
  games: { id: string; ready: boolean; state: "new" | "in_progress" | "cleared" }[];
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
  const todo = today.games.filter((g) => g.ready && g.state !== "cleared" && LAUNCH_IDS.includes(g.id));
  let saved = 0;
  for (const g of todo) {
    try {
      const r = await fetch("/api/v1/attempts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: g.id, mode: "daily" }),
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
