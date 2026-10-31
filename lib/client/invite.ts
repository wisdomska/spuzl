"use client";

/** A friend invite opened before onboarding waits here and is accepted once the player has a profile. */
const KEY = "spuzl.pendingInvite";

export function savePendingInvite(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: the player can open the link again */
  }
}

export function takePendingInvite(): string | null {
  try {
    const c = localStorage.getItem(KEY);
    if (c) localStorage.removeItem(KEY);
    return c;
  } catch {
    return null;
  }
}
