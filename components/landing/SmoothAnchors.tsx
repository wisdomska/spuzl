"use client";

import { useEffect } from "react";
import { glideTo } from "@/lib/client/smooth-scroll";

/** Same-page links ("#how", "#friends") glide to their section; the address bar still gets the hash. */
export function SmoothAnchors() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      const id = a?.getAttribute("href")?.slice(1);
      if (!id) return;
      const el = document.getElementById(decodeURIComponent(id));
      if (!el) return;
      e.preventDefault();
      history.pushState(null, "", `#${id}`);
      glideTo(el);
      // Move focus to the section for keyboard and screen reader users, without a second jump.
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
