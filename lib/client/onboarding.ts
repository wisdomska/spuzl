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
