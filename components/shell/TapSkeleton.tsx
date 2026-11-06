"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShellSkeleton } from "@/components/game/ShellSkeleton";

/**
 * R2-01: the game's skeleton (header, board outline, toolbar) on the very frame a game is tapped, so the player
 * never looks at the screen they just left, or a blank one, while the Play route loads. It covers the old screen
 * until the address changes; from then the Play route's own loading screen and board take over, without a jump.
 *
 * Shown for plain left-clicks on links to /play/... and for code that navigates to a game (`showTapSkeleton`).
 */
let open: ((href: string) => void) | null = null;
export function showTapSkeleton(href: string) {
  open?.(href);
}

const SAFETY_MS = 10_000;

export function TapSkeleton() {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  // Cleared on the render where the address has moved on (no effect needed).
  if (pending && pathname !== pending.from) setPending(null);

  useEffect(() => {
    open = (href) => {
      const to = href.split(/[?#]/)[0];
      if (to !== location.pathname) setPending({ href, from: location.pathname });
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='/play/']") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self")) return;
      open?.(a.getAttribute("href")!);
    };
    // bubble phase: links whose own handler cancels the navigation never show it
    document.addEventListener("click", onClick);
    return () => {
      open = null;
      document.removeEventListener("click", onClick);
    };
  }, []);

  // never stuck: a navigation that doesn't happen (offline, refused) lets the old screen back
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), SAFETY_MS);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  return (
    <div className="bg-bg fixed inset-0 z-[65] overflow-hidden" data-tap-skeleton>
      <ShellSkeleton />
    </div>
  );
}
