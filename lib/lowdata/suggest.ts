/**
 * Low-data suggestion (SPZ-27a): on a slow connection, offer low-data mode once.
 *
 * Signals, any one is enough:
 * - `navigator.connection.saveData` (the player already asked the browser to save data);
 * - `navigator.connection.effectiveType` of slow-2g, 2g or 3g;
 * - this page load's Navigation Timing `responseEnd` over 4 s (measured, so it also catches
 *   browsers without the Network Information API, like Safari and Firefox).
 *
 * The answer (turned on, or dismissed) is remembered on the device, so it is only ever asked once.
 */
export const SLOW_LOAD_MS = 4000;
export const SLOW_TYPES = ["slow-2g", "2g", "3g"] as const;
export const SUGGEST_KEY = "spuzl.lowDataSuggest";

export interface ConnectionHints {
  effectiveType?: string | null;
  saveData?: boolean | null;
  /** responseEnd of the navigation entry, ms from navigation start; null when unknown */
  responseEndMs?: number | null;
}

/** Pure: does this connection look slow enough to suggest low-data mode? */
export function isSlowConnection(h: ConnectionHints): boolean {
  if (h.saveData === true) return true;
  if (h.effectiveType && (SLOW_TYPES as readonly string[]).includes(h.effectiveType)) return true;
  return typeof h.responseEndMs === "number" && Number.isFinite(h.responseEndMs) && h.responseEndMs > SLOW_LOAD_MS;
}

/** Pure: show the suggestion? Never when low-data is already on or the player already answered. */
export function shouldSuggestLowData(s: { lowData: boolean; answered: boolean } & ConnectionHints): boolean {
  if (s.lowData || s.answered) return false;
  return isSlowConnection(s);
}

/** Browser: read the hints for this page load (missing APIs give nulls). */
export function readConnectionHints(): ConnectionHints {
  if (typeof window === "undefined") return {};
  const c = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  let responseEndMs: number | null = null;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // A page served by the service worker from cache is fast by design; only count real network loads.
    if (nav && nav.responseEnd > 0 && nav.transferSize !== 0) responseEndMs = nav.responseEnd - nav.startTime;
  } catch {
    /* no Navigation Timing */
  }
  return { effectiveType: c?.effectiveType ?? null, saveData: c?.saveData ?? null, responseEndMs };
}

export function readAnswered(): boolean {
  try {
    return !!localStorage.getItem(SUGGEST_KEY);
  } catch {
    return true; // storage blocked: we couldn't remember a "no", so don't ask on every load
  }
}

export function rememberAnswer(answer: "on" | "dismissed") {
  try {
    localStorage.setItem(SUGGEST_KEY, answer);
  } catch {
    /* ignore */
  }
}
