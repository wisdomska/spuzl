"use client";

import { useEffect } from "react";
import { unlock } from "@/lib/audio";

/**
 * The landing page's Play and Sign in go through the logo intro (/intro?next=…). The tap on them is the gesture that
 * lets the intro's sounds play, so audio is unlocked on that tap, before the page changes.
 */
export function IntroLinks() {
  useEffect(() => {
    const on = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Enter") return;
      const a = (e.target as Element | null)?.closest?.('a[href^="/intro"]');
      if (a) unlock();
    };
    document.addEventListener("pointerdown", on, true);
    document.addEventListener("keydown", on, true);
    return () => {
      document.removeEventListener("pointerdown", on, true);
      document.removeEventListener("keydown", on, true);
    };
  }, []);
  return null;
}
