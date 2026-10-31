/**
 * Privacy-respecting product analytics (SRS 15.2 and 16): anonymous key events only.
 *
 *   import { track } from "@/lib/analytics/track";
 *   track("attempt_clear", { game: "crownfall", mode: "daily", timeMs: 72000, hints: 0 });
 *
 * - No-op unless NEXT_PUBLIC_POSTHOG_KEY is set; posthog-js loads lazily on the first event.
 * - Anonymous: memory persistence (no cookies, no localStorage id), no person profiles, never
 *   `identify`, no autocapture, no session replay, no surveys, IP and URL query strings stripped.
 * - Off when the browser sends Do Not Track or Global Privacy Control, or after `setAnalyticsEnabled(false)`.
 * - Properties are allowlisted primitives: short strings, finite numbers, booleans. Keys that could
 *   carry personal data (nickname, email, name, ip, token, city, school...) are dropped, as are any
 *   values that look like an email address.
 */

export const KEY_EVENTS = [
  "app_open",
  "onboarding_step",
  "game_open",
  "attempt_start",
  "hint_used",
  "mistake",
  "death",
  "attempt_clear",
  "attempt_abandon",
  "results_view",
  "share",
  "level_up",
  "rank_up",
  "badge_unlock",
  "streak_change",
  "league_result",
  "quest_claim",
  "shop_view",
  "purchase",
  "friend_add",
  "challenge_sent",
  // PWA layer
  "offline_clear_queued",
  "offline_clear_synced",
  "pwa_installed",
  "notice_shown",
  "notice_action",
] as const;
export type KeyEvent = (typeof KEY_EVENTS)[number];

export type Props = Record<string, string | number | boolean | null | undefined>;

const BLOCKED_KEY =
  /(nick|name|mail|phone|ip$|^ip|address|token|secret|password|city|school|birth|user_?id|player_?id|uuid|session|cookie|text|message)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MAX_STR = 64;
const MAX_KEYS = 16;

/** Pure: the properties that are allowed to leave the device. Exported for tests. */
export function sanitize(props: Props = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k) || BLOCKED_KEY.test(k)) continue;
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.length <= MAX_STR && !EMAIL.test(v)) out[k] = v;
  }
  return out;
}

type PostHog = typeof import("posthog-js").default;

let enabled = true;
let client: Promise<PostHog | null> | null = null;

function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return n.globalPrivacyControl === true || n.doNotTrack === "1" || n.msDoNotTrack === "1";
}

function stripQuery(url: unknown) {
  if (typeof url !== "string") return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

function load(): Promise<PostHog | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
        persistence: "memory",
        person_profiles: "never",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        enable_heatmaps: false,
        respect_dnt: true,
        ip: false,
        property_denylist: ["$ip", "$referrer", "$initial_referrer", "$referring_domain", "$initial_referring_domain"],
        sanitize_properties: (p) => {
          for (const k of ["$current_url", "$pathname", "$referrer"]) if (k in p) p[k] = stripQuery(p[k]);
          return p;
        },
      });
      return posthog;
    })
    .catch(() => null);
  return client;
}

/** Records one key event. Never throws, never blocks. */
export function track(event: KeyEvent, props?: Props): void {
  if (!enabled || !process.env.NEXT_PUBLIC_POSTHOG_KEY || optedOut()) return;
  const clean = sanitize(props);
  void load().then((ph) => {
    try {
      ph?.capture(event, clean);
    } catch {
      /* analytics must never break play */
    }
  });
}

/** In-app opt-out (privacy settings). */
export function setAnalyticsEnabled(on: boolean) {
  enabled = on;
  if (!on) void client?.then((ph) => ph?.opt_out_capturing());
  else void client?.then((ph) => ph?.opt_in_capturing());
}

/** Starts PostHog early when configured (instrumentation-client.ts), so the first event is not delayed. */
export function initAnalytics() {
  if (enabled && process.env.NEXT_PUBLIC_POSTHOG_KEY && !optedOut()) void load();
}
