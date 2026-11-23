"use client";

import { useSyncExternalStore } from "react";

/**
 * Installing SPUZL on the home screen (owner, 23 Nov 2026, from Clink): the browser offers its install dialog once
 * (`beforeinstallprompt`), often before the player reaches a screen that offers "Add to home screen". It is caught
 * as the app starts (instrumentation-client.ts calls `installCapture`) and kept here, so any screen can show a
 * one-tap Install button.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** Opened from the home screen (installed), on any platform. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** The kind of device, for the right install steps. iPads that say they are Macs count as iOS. */
export function platform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document))
    return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** Start listening for the browser's install offer and for the app being installed. Safe to call more than once. */
export function installCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep it for our own button instead of the browser's mini-bar.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export type InstallState = "installed" | "prompt" | "manual";

function read(): InstallState {
  return installed || isStandalone() ? "installed" : deferred ? "prompt" : "manual";
}

/**
 * "installed": already on the home screen (or opened from it); "prompt": one tap installs it (Chrome, Edge,
 * Samsung Internet on Android and computers); "manual": show the steps (iPhone and iPad Safari, Firefox).
 */
export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    read,
    () => "manual",
  );
}

/** Shows the browser's install dialog. Resolves to true when the player installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  // The offer is used up either way; the browser may make a new one later.
  deferred = null;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}

/** For tests: forget everything. */
export function resetInstallForTests() {
  deferred = null;
  installed = false;
  started = false;
  emit();
}

/**
 * The count on the installed app's icon (Chrome and Edge on Android and computers, Safari on an installed iPhone app):
 * `n` items waiting, or none. Quiet where the browser has no app badges.
 */
export function syncAppBadge(n: number) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  void (n > 0 ? nav.setAppBadge(n) : nav.clearAppBadge?.())?.catch(() => undefined);
}
