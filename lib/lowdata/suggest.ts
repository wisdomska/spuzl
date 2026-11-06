/**
 * Low-data suggestion (SPZ-27a, timing reworked in R2-04): offer low-data mode only after this device has
 * measured slow loads, at most once per browser session, never on a fast connection.
 *
 * Measured loads (`recordLoad`), the last few kept for this session in sessionStorage:
 * - the page load itself: Navigation Timing `loadEventStart` (`responseEnd` if the load event hasn't fired),
 *   including pages the service worker answered: from its cache they are fast and reset the run, and on a slow
 *   connection the worker answers only after its 4 s network wait, which is exactly the slowness to measure;
 * - every in-app link navigation: tap on a link to the new screen's first render (`components/shell/PromptQueue`);
 * - tap-to-board on the Play screen (`lib/analytics/tap-to-board.ts`, taps only: cold loads are the page load).
 *
 * The rule (`lowDataTrigger`, thresholds from the admin settings `prompts.lowDataThresholdMs`, default 4000 ms, and
 * `prompts.lowDataSlowLoads`, default 2):
 * - `slow_loads`: the last N measured loads were all over the threshold (one fast load resets the run);
 * - `slow_net`: the browser rates the connection slow-2g, 2g or 3g (Chromium's own RTT and throughput estimate)
 *   and the latest load was over the threshold. The estimate can shorten the wait to one slow load; it never
 *   shows the suggestion by itself, and Save-Data alone does not either (it already stops background downloads).
 * A fast load (under the threshold) never counts, so a fast connection never sees it.
 *
 * Shown at most once per session (`sessionStorage['spuzl.lowDataAsked']`). "Turn on" switches the setting, which
 * is the lasting answer; "Not now" holds for the session. Placement and one-prompt-per-screen are the prompt
 * queue's job.
 */
import type { LowDataTrigger } from "@/lib/prompts/ids";

export const SLOW_TYPES = ["slow-2g", "2g", "3g"] as const;
export const LOADS_KEY = "spuzl.loads";
export const ASKED_KEY = "spuzl.lowDataAsked";
export const LOADS_EVENT = "spuzl:loads";
/** Loads kept per session (the admin setting allows a run of at most 5). */
export const MAX_SAMPLES = 5;
/** Measurements above this are dropped (a tab left in the background, a sleeping phone). */
export const MAX_LOAD_MS = 120_000;

export interface ConnectionHints {
  effectiveType?: string | null;
}

/** Pure: how many of the latest loads in a row were over the threshold. */
export function slowRun(samples: readonly number[], thresholdMs: number): number {
  let n = 0;
  for (let i = samples.length - 1; i >= 0 && samples[i] > thresholdMs; i--) n++;
  return n;
}

/** Pure: why to suggest low-data mode now, or null. */
export function lowDataTrigger(i: {
  samples: readonly number[];
  thresholdMs: number;
  slowLoads: number;
  effectiveType?: string | null;
}): LowDataTrigger | null {
  const run = slowRun(i.samples, i.thresholdMs);
  if (run === 0) return null;
  if (run >= Math.max(1, i.slowLoads)) return "slow_loads";
  if (i.effectiveType && (SLOW_TYPES as readonly string[]).includes(i.effectiveType)) return "slow_net";
  return null;
}

/** Pure: show the suggestion? Never with low-data already on or once asked this session. */
export function shouldSuggestLowData(s: { lowData: boolean; askedThisSession: boolean; trigger: LowDataTrigger | null }): boolean {
  return !s.lowData && !s.askedThisSession && s.trigger !== null;
}

/** Pure: the samples list after a new measurement (bad values ignored, last MAX_SAMPLES kept). */
export function addSample(samples: readonly number[], ms: number): number[] {
  if (!Number.isFinite(ms) || ms < 0 || ms > MAX_LOAD_MS) return [...samples];
  return [...samples, Math.round(ms)].slice(-MAX_SAMPLES);
}

/** Pure: parses the stored samples. */
export function parseSamples(raw: string | null): number[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(-MAX_SAMPLES) : [];
  } catch {
    return [];
  }
}

// ---------- browser ----------

/** Browser: the connection estimate (null where the Network Information API is missing). */
export function readConnectionHints(): ConnectionHints {
  if (typeof navigator === "undefined") return {};
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return { effectiveType: c?.effectiveType ?? null };
}

/** Browser: this page load's duration, or null when unknown. */
export function readPageLoadMs(): number | null {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return null;
    const end = nav.loadEventStart > 0 ? nav.loadEventStart : nav.responseEnd;
    return end > 0 ? end - nav.startTime : null;
  } catch {
    return null;
  }
}

export function readSamplesRaw(): string | null {
  try {
    return sessionStorage.getItem(LOADS_KEY);
  } catch {
    return null;
  }
}

/** Browser: adds one measured load for this session. */
export function recordLoad(ms: number) {
  try {
    const next = addSample(parseSamples(sessionStorage.getItem(LOADS_KEY)), ms);
    sessionStorage.setItem(LOADS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(LOADS_EVENT));
  } catch {
    /* storage blocked: no measurements, no suggestion */
  }
}

export function subscribeLoads(onChange: () => void) {
  window.addEventListener(LOADS_EVENT, onChange);
  return () => window.removeEventListener(LOADS_EVENT, onChange);
}

export function readAskedThisSession(): boolean {
  try {
    return sessionStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true; // storage blocked: we couldn't keep it to once a session
  }
}

export function markAskedThisSession() {
  try {
    sessionStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* ignore */
  }
}
