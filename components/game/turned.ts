"use client";

import { useSyncExternalStore } from "react";

/**
 * Landscape for the action games when the phone will not turn by itself (owner, 19 Nov 2026: "fullscreen on mobile
 * still doesn't change the orientation"). Locking the screen sideways only works in some browsers (Chrome on
 * Android); iPhone, iPad, Firefox and Samsung Internet refuse it. So when full screen is on and the screen is still
 * upright, the page turns itself: `html[data-turned]` rotates the body a quarter turn (app/globals.css, upright
 * screens only), and the viewport sizes the layout reads are swapped to match (`viewportSize`). Turning the phone
 * for real ends the rotation by itself (the CSS only applies while the screen is upright).
 */
let on = false;
const subs = new Set<() => void>();

export function setTurned(next: boolean) {
  if (typeof document === "undefined" || on === next) return;
  on = next;
  document.documentElement.toggleAttribute("data-turned", next);
  subs.forEach((f) => f());
  // Everything sized from the viewport measures again.
  window.dispatchEvent(new Event("resize"));
}

/** Is the page turned right now (asked for, and the screen still upright)? */
export function turnedNow(): boolean {
  return on && typeof window !== "undefined" && window.innerHeight > window.innerWidth;
}

/** The viewport as the layout sees it: width and height swapped while the page is turned. */
export function viewportSize(): { w: number; h: number } {
  const w = window.innerWidth,
    h = window.innerHeight;
  return turnedNow() ? { w: h, h: w } : { w, h };
}

/**
 * A point on the page in the turned layout's own coordinates, from a pointer's screen position: the body is
 * rotated 90° clockwise, so its top edge is the screen's right edge and its left edge the screen's top.
 */
export function layoutPoint(clientX: number, clientY: number): { x: number; y: number } {
  return turnedNow() ? { x: clientY, y: window.innerWidth - clientX } : { x: clientX, y: clientY };
}

/** The top of a box (a screen rect) in the turned layout's own coordinates. */
export function layoutTopOf(r: DOMRect): number {
  return turnedNow() ? window.innerWidth - r.right : r.top;
}

/** The body's padding above and below the page while turned (the safe areas, app/globals.css), else 0. */
export function turnedInsets(): number {
  if (!turnedNow()) return 0;
  const cs = getComputedStyle(document.body);
  return (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

/** Was turning asked for (full screen on a landscape game)? */
export function useTurned(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );
}
