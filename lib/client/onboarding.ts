"use client";

/** First-run state kept on the device until the profile exists on the server. */
const KEY = "spuzl.onboarding";
export interface Onboarding {
  ageBand?: "13-15" | "16-17" | "18+";
  tutorialDone?: boolean;
  introSeen?: boolean;
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
