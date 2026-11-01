"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * In-app history, for Back buttons on screens people reach by deep link (/duel, /party, a shared
 * challenge). `history.length` can't tell an in-app page from another site or a fresh tab, so we
 * remember the first path this page load landed on and whether the app has navigated since.
 * A reload starts over, which only ever makes Back go to the Grid (never out of the app).
 */
let entry: string | null = null;
let navigated = false;

/** Pure: may Back use the browser history, or must it go to the Grid? */
export function backAction(s: { entry: string | null; navigated: boolean; current: string }): "back" | "home" {
  if (!s.navigated || s.entry === null) return "home";
  return s.current === s.entry ? "home" : "back";
}

/** Mount once (Providers): records the landing path and every client-side navigation after it. */
export function useNavTracker() {
  const path = usePathname();
  useEffect(() => {
    if (entry === null) entry = path;
    else if (path !== entry) navigated = true;
  }, [path]);
}

/** Back that goes to the previous in-app screen, or to the Grid when the page was opened directly. */
export function useBackOrHome() {
  return useBackOr("/");
}

/** Back within the app; on a deep link or fresh tab, go to `fallback` (never out of the app). */
export function useBackOr(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    const action = backAction({ entry, navigated, current: window.location.pathname });
    if (action === "back") router.back();
    else router.push(fallback as never);
  }, [router, fallback]);
}
