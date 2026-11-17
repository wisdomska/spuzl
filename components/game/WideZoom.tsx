"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
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
    const zoomFor = () => {
      // The board's own size: measured at zoom 1 and free of the column around it, which may still be narrow (the
      // shell switching to two columns after hydrating) and which squeezes a zoomed board through max-w-full (a zoom
      // measured too big then shrinks the board, frame by frame). Both are put back before anything paints.
      const s = el.style;
      const saved = [s.zoom, s.flexShrink, s.maxWidth] as const;
      s.zoom = "1";
      s.flexShrink = "0";
      s.maxWidth = "none";
      const nat = {
        w: Math.max(el.scrollWidth, el.offsetWidth, el.firstElementChild?.scrollWidth ?? 0),
        h: Math.max(el.scrollHeight, el.offsetHeight),
      };
      [s.zoom, s.flexShrink, s.maxWidth] = saved;
      const room = { w: column - SLOT_PAD * 2, h: window.innerHeight - WIDE_TOP - WIDE_BOTTOM - SLOT_PAD };
      return wideZoom(nat, room);
    };
    setZoom(zoomFor());
    // The board resizing itself, or the window: the new zoom lands with React's next render. Never synchronously in
    // here: under reduced motion every element has a 1 ms transition (styles/spuzl-tokens.css), so a zoom changed
    // inside this callback leaves the board's borders still moving and Chrome reports "ResizeObserver loop completed
    // with undelivered notifications" as a window error (Sentry).
    const measure = () => setZoom(zoomFor());
    const ro = new ResizeObserver(measure);
    const watched = () => el.firstElementChild ?? el;
    let child = watched();
    ro.observe(child);
    // Boards load lazily: the first measure is of the skeleton (next/dynamic's loading), which the board then
    // replaces. Re-measure the moment it does and apply that zoom at once (a mutation callback runs right after
    // React's commit, before the browser lays out or paints): left to the observer above, the board kept the
    // skeleton's zoom for a frame (Flinch at 1280 × 800: 1.08 instead of 1.05, a page 819 px tall, R4 fit check).
    // Then watch the board itself, not the skeleton that left.
    const mo = new MutationObserver(() => {
      const now = watched();
      if (now === child) return;
      ro.unobserve(child);
      child = now;
      ro.observe(child);
      const next = zoomFor();
      flushSync(() => setZoom(next));
    });
    mo.observe(el, { childList: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [on, column]);
  return (
    <div
      ref={ref}
      // Off (phones, canvas games that size themselves from their container): the wrapper takes no box at all, and
      // stays in the tree so a resize across the wide breakpoint never remounts (restarts) the game.
      className={on ? "flex w-fit max-w-full justify-center" : "contents"}
      // No transition, ever: reduced motion gives every property a 1 ms transition (styles/spuzl-tokens.css), and a
      // transitioned zoom keeps the old size for a frame after each change (the page a frame too tall, R4 fit checks).
      style={on ? { transitionProperty: "none", ...(zoom !== 1 ? { zoom } : null) } : undefined}
      data-wide-zoom={on ? zoom : undefined}
    >
      {children}
    </div>
  );
}
