"use client";

import { useEffect } from "react";

/**
 * iOS has no Vibration API. When a haptic fires there, give the element the player just touched a
 * 2 px micro-shake (transform only, 180 ms) so the feedback still lands. Skipped under reduced motion.
 */
export function HapticFallback() {
  useEffect(() => {
    let lastTarget: HTMLElement | null = null;
    const onDown = (e: PointerEvent) => {
      lastTarget = (e.target as HTMLElement)?.closest?.("button, [role=gridcell], [data-haptic-target]") as HTMLElement | null;
    };
    const onFallback = () => {
      if (document.documentElement.dataset.motion === "reduce") return;
      const el = lastTarget;
      if (!el) return;
      el.classList.remove("haptic-shake");
      void el.offsetWidth;
      el.classList.add("haptic-shake");
      window.setTimeout(() => el.classList.remove("haptic-shake"), 200);
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("spuzl:haptic-fallback", onFallback);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("spuzl:haptic-fallback", onFallback);
    };
  }, []);
  return null;
}
