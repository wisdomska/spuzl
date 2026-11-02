"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LeavePolicy } from "@/lib/game/leave";

/** History entry marker for the back-gesture guard (same URL, so the address never changes). */
const GUARD = "spuzlLeaveGuard";
/** The leave or resign call gets this long before the player goes anyway (offline must never trap anyone). */
const FORFEIT_WAIT_MS = 2500;
/** The guard owned by the mounted game; a remount (StrictMode, a new puzzle) adopts the entry already there. */
let owner = 0;
let seq = 0;

const onGuard = () => typeof window !== "undefined" && !!(window.history.state as Record<string, unknown> | null)?.[GUARD];

/**
 * One way out of a game, whatever the route: the Back button, the menu's Leave game, Escape (no dialog open)
 * and the browser or phone back gesture all go through `request`. With no confirm in the policy the player
 * leaves at once; otherwise `asking` opens the confirm and `confirm` leaves.
 *
 * Back gesture: only while a confirm is needed, one extra history entry (same URL) sits on top. A back
 * gesture pops it and opens the confirm instead of leaving; a second back always leaves (the forfeit call
 * still goes out, with keepalive). When the guard is no longer needed (the run ends) the entry is taken off
 * again so Back is never swallowed. Leaving from the confirm takes the entry off first, then exits, so the
 * history ends up as if there had been no guard.
 *
 * `forfeit` is the screen's leave or resign call; it runs before `exit` (bounded by FORFEIT_WAIT_MS).
 */
export function useLeave({
  policy,
  exit,
  forfeit,
  escape = true,
}: {
  policy: LeavePolicy;
  exit: () => void;
  forfeit?: (opts: { keepalive: boolean }) => Promise<unknown> | void;
  /** Escape asks to leave (off when the screen has its own Escape use) */
  escape?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = useRef({ policy, exit, forfeit });
  useEffect(() => {
    live.current = { policy, exit, forfeit };
  });
  // The confirm was opened by a back gesture (the guard entry is gone): another back leaves.
  const fromGesture = useRef(false);
  // Leaving from the confirm with the guard entry still on top: exit once the entry is off.
  const exitAfterPop = useRef(false);
  const done = useRef(false);

  const runForfeit = useCallback(async (keepalive: boolean) => {
    const f = live.current.policy.forfeit ? live.current.forfeit : undefined;
    if (!f) return;
    await Promise.race([Promise.resolve(f({ keepalive })).catch(() => {}), new Promise((r) => setTimeout(r, FORFEIT_WAIT_MS))]);
  }, []);

  const leave = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    setBusy(true);
    await runForfeit(false);
    setAsking(false);
    if (onGuard()) {
      exitAfterPop.current = true;
      window.history.back();
    } else live.current.exit();
  }, [runForfeit]);

  /** Where focus goes back to when the player keeps playing (the button that asked, if it is still there). */
  const opener = useRef<HTMLElement | null>(null);

  /** Back, menu, Escape: leave now, or ask first. */
  const request = useCallback(() => {
    if (done.current) return;
    if (live.current.policy.kind === "none") void leave();
    else {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAsking(true);
    }
  }, [leave]);

  /** Focus after Keep playing: the opener when it is still on the page, else `fallback`. */
  const restoreFocus = useCallback((fallback?: HTMLElement | null) => {
    const el = opener.current?.isConnected ? opener.current : fallback;
    opener.current = null;
    requestAnimationFrame(() => el?.focus());
  }, []);

  const keep = useCallback(() => {
    setAsking(false);
    // The gesture took the guard entry off: put it back so the next back asks again.
    if (fromGesture.current && live.current.policy.guard && !onGuard()) {
      window.history.pushState({ ...(window.history.state ?? {}), [GUARD]: true }, "");
    }
    fromGesture.current = false;
  }, []);

  // The back-gesture guard, only while a confirm is needed.
  const guard = policy.guard;
  useEffect(() => {
    if (!guard) return;
    const id = ++seq;
    owner = id;
    if (!onGuard()) window.history.pushState({ ...(window.history.state ?? {}), [GUARD]: true }, "");
    const onPop = () => {
      if (exitAfterPop.current) {
        exitAfterPop.current = false;
        live.current.exit();
        return;
      }
      if (onGuard() || done.current) return;
      if (fromGesture.current) {
        // Second back: the browser is already leaving. Tell the server on the way out.
        done.current = true;
        void runForfeit(true);
        return;
      }
      fromGesture.current = true;
      setAsking(true);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (owner === id) owner = 0;
      // No longer guarded (the run ended) and still on our entry: take it off after any remount had its chance.
      setTimeout(() => {
        if (owner === 0 && onGuard() && !exitAfterPop.current) window.history.back();
      }, 0);
    };
  }, [guard, runForfeit]);

  // Escape leaves (or asks) when no dialog, sheet or menu is open and nothing else used the key.
  useEffect(() => {
    if (!escape) return;
    // Decided in the capture phase, before any dialog or menu handles this Escape and closes itself.
    let blocked = false;
    const onCapture = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      blocked =
        e.repeat ||
        !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [data-game-menu]') ||
        !!t?.closest?.("input, textarea, select, [contenteditable='true']");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || blocked || e.defaultPrevented) return;
      request();
    };
    window.addEventListener("keydown", onCapture, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onCapture, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [escape, request]);

  return { asking, busy, request, keep, confirm: leave, restoreFocus };
}
