"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SLOT_PAD, WIDE_BOTTOM, WIDE_TOP } from "./useBoardSize";

/** Never scale a board past this (big type stays comfortable, tiles never look bloated). */
export const WIDE_ZOOM_MAX = 1.6;

/** The zoom that makes a board of natural size `nat` fill `room` (both px), between 1 and WIDE_ZOOM_MAX. */
export function wideZoom(nat: { w: number; h: number }, room: { w: number; h: number }): number {
  if (nat.w <= 0 || nat.h <= 0) return 1;
  const k = Math.min(room.w / nat.w, room.h / nat.h);
  // Small differences are noise from rounding: leave the board as it is.
  return k < 1.04 ? 1 : Math.min(WIDE_ZOOM_MAX, Math.floor(k * 100) / 100);
}

/**
 * Wide screens only (owner, 14 Nov 2026: "make full and good use of larger screens"): a board that stays at its phone
 * size (word tiles, cards, keyboards) is scaled up with CSS zoom until it fills the board column's width or the
 * height under the top bar. Zoom is a real layout zoom, so text stays sharp, hit areas grow with it and pointer
 * positions stay right. Boards that already grow to their column measure about the column's size and stay at 1.
 */
export function WideZoom({ on, column, children }: { on: boolean; column: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return setZoom(1);
    const measure = () => {
      const z = parseFloat(el.style.zoom || "1") || 1;
      const r = el.getBoundingClientRect();
      // getBoundingClientRect includes the zoom: divide it back out for the board's own size.
      const nat = {
        w: Math.max(el.scrollWidth, el.firstElementChild?.scrollWidth ?? 0, r.width / z),
        h: Math.max(r.height / z, el.scrollHeight),
      };
      const room = { w: column - SLOT_PAD * 2, h: window.innerHeight - WIDE_TOP - WIDE_BOTTOM - SLOT_PAD };
      setZoom(wideZoom(nat, room));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.firstElementChild ?? el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [on, column]);
  return (
    <div
      ref={ref}
      // Off (phones, canvas games that size themselves from their container): the wrapper takes no box at all, and
      // stays in the tree so a resize across the wide breakpoint never remounts (restarts) the game.
      className={on ? "flex w-fit max-w-full justify-center" : "contents"}
      style={on && zoom !== 1 ? { zoom } : undefined}
      data-wide-zoom={on ? zoom : undefined}
    >
      {children}
    </div>
  );
}
