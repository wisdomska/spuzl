"use client";

/** First-run state kept on the device until the profile exists on the server. */
const KEY = "spuzl.onboarding";
export interface Onboarding {
  tutorialDone?: boolean;
  introSeen?: boolean;
  /** Set when a new profile is made on /welcome; Home clears it and records "reached Home" (admin Metrics). */
  homePending?: boolean;
  /** A deep link the visitor came in on (only known pages, e.g. /daily): onboarding ends there instead of Home. */
  returnTo?: string;
}
export function readOnboarding(): Onboarding {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
export function writeOnboarding(patch: Onboarding) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readOnboarding(), ...patch }));
  } catch {
    /* private mode */
  }
}

/** `?return=` values the first-run pages accept, and where each one leads back to after onboarding. */
const RETURNS: Record<string, string> = { daily: "/daily" };

/** Remembers a known `?return=` value from the address (the intro and Welcome read it on arrival). */
export function rememberReturn(param: string | null | undefined) {
  const to = param ? RETURNS[param] : undefined;
  if (to) writeOnboarding({ returnTo: to });
}

/** Where onboarding should end (a remembered deep link), used once; null for the usual destination. */
export function takeReturn(): string | null {
  const to = readOnboarding().returnTo;
  if (!to) return null;
  writeOnboarding({ returnTo: undefined });
  return Object.values(RETURNS).includes(to) ? to : null;
}

/**
 * R2-08: the landing page's playable Crownfall (components/landing/TryIt.tsx), solved before onboarding. Kept for
 * this tab only (sessionStorage) and only for a while, then counted on /welcome as the first clear: the same fixed
 * public board as the welcome lesson, so it goes through the lesson's own record (a tutorial attempt the server
 * re-verifies from the board state). Board state and active time only; nothing about the visitor.
 */
const DEMO_KEY = "spuzl.demoClear";
/** A clear older than this is not carried into onboarding (a visitor who wanders off and comes back starts fresh). */
export const DEMO_CLEAR_TTL_MS = 60 * 60_000;
export interface DemoClear {
  game: "crownfall";
  /** the solved board, as the board reported it (Crownfall: 16 cells) */
  state: number[];
  /** active time from the first tap to the clear */
  ms: number;
  /** when it was solved (Date.now()) */
  at: number;
}

/** Reads a stored demo clear; null when missing, malformed, from the future or older than DEMO_CLEAR_TTL_MS. */
export function parseDemoClear(raw: string | null | undefined, now = Date.now()): DemoClear | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<DemoClear>;
  if (c.game !== "crownfall") return null;
  if (!Array.isArray(c.state) || c.state.length !== 16 || !c.state.every((x) => x === 0 || x === 1 || x === 2)) return null;
  if (typeof c.ms !== "number" || !Number.isFinite(c.ms) || c.ms < 0 || c.ms > 86_400_000) return null;
  if (typeof c.at !== "number" || c.at > now + 60_000 || now - c.at > DEMO_CLEAR_TTL_MS) return null;
  return { game: "crownfall", state: c.state, ms: Math.round(c.ms), at: c.at };
}

export function rememberDemoClear(c: Omit<DemoClear, "game" | "at">) {
  try {
    sessionStorage.setItem(DEMO_KEY, JSON.stringify({ game: "crownfall", state: c.state, ms: Math.round(c.ms), at: Date.now() }));
  } catch {
    /* storage blocked: the visitor just gets the lesson */
  }
}

export function readDemoClear(): DemoClear | null {
  try {
    return parseDemoClear(sessionStorage.getItem(DEMO_KEY));
  } catch {
    return null;
  }
}

/** Used once (counted with the new profile) or dropped (under 13: nothing kept, not even on this device). */
export function forgetDemoClear() {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* nothing to drop */
  }
}
