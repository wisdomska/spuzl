"use client";

/**
 * Keeping the installed app current without asking (owner, 23 Nov 2026, from Clink). The worker (public/sw.js)
 * takes over as soon as a new version installs; this side makes the open page follow it:
 * - A new version never reloads the screen in front of the player: the page switches over while it is hidden
 *   (another app, the lock screen) or the next time the player comes back to it.
 * - Never in the middle of a game: on a game screen it waits until the player has left it.
 * - It looks for a new version every 15 minutes and whenever the player comes back.
 * - A tab left open across a release can ask for code the new version no longer has: it reloads once.
 */

/** Screens where a reload would interrupt play (a board, a live match, a room). */
export const IN_GAME = /^\/(play|duel|party|bay|challenge|race)(\/|$)/;
const CHECK_EVERY_MS = 15 * 60_000;
const CHUNK_RELOAD_KEY = "spuzl.chunkReload";

/** A failed load of a script chunk (a release replaced it while this page was open). */
export function isChunkError(message: string): boolean {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

/** Follows new versions of the worker (call once, after it is registered). Returns a stop function. */
export function followUpdates(reg: ServiceWorkerRegistration | null): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};
  let hadController = !!navigator.serviceWorker.controller;
  let pending = false;
  const offGame = () => !IN_GAME.test(window.location.pathname);
  const switchOver = () => {
    if (pending && offGame()) {
      pending = false;
      window.location.reload();
    }
  };
  const onControllerChange = () => {
    // The very first install also fires this: nothing to refresh then.
    if (!hadController) {
      hadController = true;
      return;
    }
    pending = true;
    // Hidden right now (another app, the lock screen): switch over unseen.
    if (document.visibilityState === "hidden") switchOver();
  };
  const onVisibility = () => {
    switchOver();
    if (document.visibilityState === "visible") void reg?.update().catch(() => undefined);
  };
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  document.addEventListener("visibilitychange", onVisibility);
  const timer = reg ? setInterval(() => void reg.update().catch(() => undefined), CHECK_EVERY_MS) : undefined;
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    document.removeEventListener("visibilitychange", onVisibility);
    if (timer) clearInterval(timer);
  };
}

/** Reloads once when a script chunk from an older release can't be loaded (a second failure is left alone). */
export function reloadOnChunkError(): () => void {
  if (typeof window === "undefined") return () => {};
  const onError = (e: PromiseRejectionEvent | ErrorEvent) => {
    const reason = "reason" in e ? (e.reason as { message?: string } | undefined) : undefined;
    const msg = String(reason?.message ?? ("message" in e ? e.message : "") ?? "");
    if (!isChunkError(msg)) return;
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    } catch {
      return; // no storage: never risk a reload loop
    }
    window.location.reload();
  };
  window.addEventListener("unhandledrejection", onError);
  window.addEventListener("error", onError);
  return () => {
    window.removeEventListener("unhandledrejection", onError);
    window.removeEventListener("error", onError);
  };
}
