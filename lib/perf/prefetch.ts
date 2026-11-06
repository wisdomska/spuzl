"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { preloadBoard } from "@/games/board-registry";
import { parsePlayHref } from "@/lib/client/early-attempt";

type Router = ReturnType<typeof useRouter>;

/**
 * R2-01: prefetch a Play link in full (the page's data and the code it needs, not just its loading screen) and the
 * game's board chunk, so tapping it shows the board with no wait for code. Use only for the one or two links a
 * player is most likely to tap next (the Continue target, an opened game card): a full prefetch is a real download.
 */
export function warmPlay(router: Router, href: string) {
  // "full" is Next's PrefetchKind.FULL (next/dist/client/components/router-reducer/router-reducer-types).
  router.prefetch(href, { kind: "full" } as never);
  const t = parsePlayHref(href);
  const id = t?.game ?? /^\/play\/([a-z0-9]+)/.exec(href)?.[1];
  if (id) preloadBoard(id);
}

/** Warms `href` once the current screen has been up for a moment and the browser is idle. */
export function useWarmPlay(href: string | null | undefined, delayMs = 800) {
  const router = useRouter();
  useEffect(() => {
    if (!href) return;
    let live = true;
    const go = () => live && warmPlay(router, href);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const t = setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 1500 }) : go()), delayMs);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [href, router, delayMs]);
}
