"use client";

import { useEffect } from "react";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";

/**
 * Scroll reveal for the public pages (R6): every `[data-reveal]` element still below the fold fades up 12 px the first
 * time it scrolls into view, once (styles in app/globals.css). Elements already on screen are marked revealed before
 * the page is armed, so nothing visible blinks out; without JS nothing is ever hidden. Reduced motion: off.
 */
export function Reveal() {
  const hydrated = useSettings((s) => s.hydrated);
  const reduce = useSettings((s) => prefersReducedMotion(s));
  useEffect(() => {
    if (!hydrated || reduce || typeof IntersectionObserver === "undefined") return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])"));
    const fold = window.innerHeight;
    const later = els.filter((el) => {
      if (el.getBoundingClientRect().top < fold) {
        el.dataset.revealed = "";
        return false;
      }
      return true;
    });
    if (!later.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.revealed = "";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    later.forEach((el) => io.observe(el));
    const root = document.documentElement;
    root.classList.add("reveal-armed");
    return () => {
      io.disconnect();
      root.classList.remove("reveal-armed");
    };
  }, [hydrated, reduce]);
  return null;
}
