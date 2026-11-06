/**
 * When to ask for notifications (R2-04). Never cold: only after a moment that makes alerts useful.
 *
 * Triggers (each fires once per device, the first time it happens; admin `prompts.alertsTriggers` picks which
 * count):
 * - `friend`: the first friend (a request accepted, by either side), seen in the friends list the server sends;
 * - `invite`: the first Duel or Party invite sent to a friend or received from one;
 * - `streak`: the player's streak (server value) reaches `prompts.alertsStreakDays`.
 *
 * The ask is due when a counted trigger fired after the last ask and the last ask is at least
 * `prompts.alertsCooldownDays` old. So "Not now" is followed by at most one ask per cooldown, and each trigger
 * earns at most one ask: three in all. Where it may show is the queue's job (`isQuietScreen`).
 *
 * Stored on the device only (`localStorage['spuzl.alertsAsk']`): trigger kinds with a timestamp and the time of the
 * last ask. Nothing about who the friend is, no new personal data, nothing sent to the server.
 */
import { ALERTS_TRIGGERS, type AlertsTrigger } from "./ids";

export const ALERTS_KEY = "spuzl.alertsAsk";
/** The older "Not now" record (`{n, at}` or "1"); its time seeds the cooldown. */
export const LEGACY_ALERTS_KEY = "spuzl.alertsAsked";
export const ALERTS_EVENT = "spuzl:alerts-ask";
const DAY_MS = 24 * 3600_000;

export interface AlertsAskState {
  fired: Partial<Record<AlertsTrigger, number>>;
  /** epoch ms of the last time the ask was shown (0 = never) */
  lastAskAt: number;
}

export const emptyAlertsState = (): AlertsAskState => ({ fired: {}, lastAskAt: 0 });

/** Pure: parses the stored state (and the legacy record); anything unreadable is a fresh state. */
export function parseAlertsState(raw: string | null, legacy: string | null = null): AlertsAskState {
  const out = emptyAlertsState();
  try {
    const v = raw ? (JSON.parse(raw) as Partial<AlertsAskState>) : null;
    if (v && typeof v === "object") {
      for (const t of ALERTS_TRIGGERS) {
        const at = v.fired?.[t];
        if (typeof at === "number" && Number.isFinite(at) && at > 0) out.fired[t] = at;
      }
      if (typeof v.lastAskAt === "number" && Number.isFinite(v.lastAskAt)) out.lastAskAt = Math.max(0, v.lastAskAt);
    }
  } catch {
    /* fresh */
  }
  if (!out.lastAskAt && legacy) {
    try {
      const l = legacy === "1" ? null : (JSON.parse(legacy) as { at?: number });
      if (l && typeof l.at === "number" && Number.isFinite(l.at)) out.lastAskAt = Math.max(0, l.at);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Pure: records a trigger the first time it happens (later ones change nothing). */
export function fireTrigger(s: AlertsAskState, trigger: AlertsTrigger, now: number): AlertsAskState {
  if (s.fired[trigger]) return s;
  return { ...s, fired: { ...s.fired, [trigger]: now } };
}

/** Pure: the ask was shown now. */
export const markAsked = (s: AlertsAskState, now: number): AlertsAskState => ({ ...s, lastAskAt: now });

/**
 * Pure: the trigger that makes the ask due now (the most recent counted one fired since the last ask), or null.
 */
export function dueTrigger(s: AlertsAskState, o: { enabled: readonly string[]; cooldownDays: number; now: number }): AlertsTrigger | null {
  if (s.lastAskAt && o.now - s.lastAskAt < o.cooldownDays * DAY_MS) return null;
  let best: AlertsTrigger | null = null;
  for (const t of ALERTS_TRIGGERS) {
    const at = s.fired[t];
    if (!at || at <= s.lastAskAt || !o.enabled.includes(t)) continue;
    if (best === null || at > s.fired[best]!) best = t;
  }
  return best;
}

/** Pure: has the streak earned the streak trigger? */
export const streakReached = (current: number | null | undefined, days: number) => typeof current === "number" && current >= days;

// ---------- browser ----------

export function readAlertsRaw(): string | null {
  try {
    return localStorage.getItem(ALERTS_KEY) ?? `legacy:${localStorage.getItem(LEGACY_ALERTS_KEY) ?? ""}`;
  } catch {
    return null;
  }
}

/** The stored state from `readAlertsRaw()`'s snapshot. Storage blocked (null): a state that never asks. */
export function alertsStateFrom(raw: string | null): AlertsAskState {
  if (raw === null) return { fired: {}, lastAskAt: Number.MAX_SAFE_INTEGER };
  if (raw.startsWith("legacy:")) return parseAlertsState(null, raw.slice(7) || null);
  return parseAlertsState(raw);
}

function write(s: AlertsAskState) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event(ALERTS_EVENT));
  } catch {
    /* storage blocked: we couldn't remember a "Not now", so we never ask */
  }
}

/** Records a trigger on this device (no-op after the first time, or without storage). */
export function noteAlertsTrigger(trigger: AlertsTrigger) {
  if (typeof window === "undefined") return;
  const raw = readAlertsRaw();
  if (raw === null) return;
  const s = alertsStateFrom(raw);
  const next = fireTrigger(s, trigger, Date.now());
  if (next !== s) write(next);
}

/** Records that the ask was shown now. */
export function noteAlertsAsked() {
  if (typeof window === "undefined") return;
  const raw = readAlertsRaw();
  if (raw === null) return;
  write(markAsked(alertsStateFrom(raw), Date.now()));
}

export function subscribeAlerts(onChange: () => void) {
  window.addEventListener(ALERTS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ALERTS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
