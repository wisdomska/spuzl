"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

/** The game shell's board slot pads the board by this much on each side (GameShell's board `main`, px-3). */
export const SLOT_PAD = 12;
/**
 * Height of the shell around a board on a wide screen: the slim top bar (with its desktop top padding), the
 * board slot's own padding, the feedback line and the tool row. A board that grows past the phone fit keeps
 * a square board inside the viewport height with this much room for the rest.
 */
export const SHELL_CHROME = 232;

/**
 * Board sizing rule (Game Boards template): cell = floor((min(vw, 420) − 24 − gaps − padding) / cols),
 * capped at `max`. Boards always fit the screen width: big grids get smaller cells instead of a
 * sideways scroll (never below 24 px, the WCAG 2.5.8 minimum target). Wider than a phone (tablets,
 * desktop) the board may use the shell's full 560 px width, as long as a square board still fits the
 * viewport height.
 */
export function useCellSize(cols: number, gap: number, padding = 6, max = 64): number {
  return cellSize(useViewportWidth(), useViewportHeight(), cols, gap, padding, max);
}

/** The pure rule behind `useCellSize`. */
export function cellSize(vw: number, vh: number, cols: number, gap: number, padding: number, max: number): number {
  const overhead = gap * (cols - 1) + padding;
  const across = (w: number) => Math.floor((w - SLOT_PAD * 2 - overhead) / cols);
  const phone = across(Math.min(vw, 420));
  const wide = across(Math.min(vw, 560));
  const tall = Math.floor((vh - SHELL_CHROME - overhead) / cols);
  return Math.max(24, Math.min(max, Math.max(phone, Math.min(wide, tall))));
}

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

/**
 * Viewport width in px, kept current on resize. Server rendering (and hydrating it) uses 390; a board that
 * mounts on the client reads the real width on its first render. A first render at 390 on a narrower phone
 * would overflow, and mobile browsers then zoom out and report the wider width back, so it never recovers.
 */
export function useViewportWidth(): number {
  return useSyncExternalStore(
    onResize,
    () => window.innerWidth,
    () => 390,
  );
}

/** Viewport height in px, kept current on resize (844 while server rendering). */
export function useViewportHeight(): number {
  return useSyncExternalStore(
    onResize,
    () => window.innerHeight,
    () => 844,
  );
}

/**
 * Cell size with a floor for dense boards (Nine). `overhead` is every px across the board that is not a cell
 * (gaps, lines, padding). The roomy fit sits inside the shell's 12 px board padding (24 px in all, width
 * capped at `cap`). If that falls below `floor`, the board may also use that padding, edge to edge, to keep
 * `floor`; when even that does not fit (the narrowest phones) it takes the largest cell that fits, never
 * under 24 px (WCAG 2.5.8).
 */
export function fitCell(vw: number, cols: number, overhead: number, floor: number, max: number, cap = 560): number {
  const roomy = Math.floor((Math.min(vw, cap) - SLOT_PAD * 2 - overhead) / cols);
  if (roomy >= floor) return Math.min(max, roomy);
  const edgeToEdge = Math.floor((vw - overhead) / cols);
  return Math.max(24, Math.min(floor, edgeToEdge));
}

/**
 * One step of the height fit (pure, for `useFitHeight`). `over` is how many px the page (or the target
 * element) reaches past the bottom of the viewport; `unit` is the px of height one step of size is worth.
 * Shrinks by just enough steps (never under `min`). Grows back towards `ideal` only when `canGrow` (a target
 * element, whose bottom is its natural position) and there is room for a whole step with 2 px to spare.
 */
export function fitStep(cur: number, ideal: number, min: number, unit: number, over: number, canGrow: boolean): number {
  if (over > 0) return Math.max(Math.min(min, ideal), cur - Math.ceil(over / unit));
  if (canGrow && cur < ideal && -over >= unit + 2) return Math.min(ideal, cur + Math.floor((-over - 2) / unit));
  return cur;
}

/**
 * Where the game shell's content ends: the bottom of its last zone marked `data-shell-tail` (the feedback line,
 * then the tool bar or end bar), less the auto margin that pins the tool bar to the bottom of a roomy screen.
 * Null outside a shell.
 */
export function shellContentBottom(el: HTMLElement): number | null {
  const tails = el.closest("[data-shell]")?.querySelectorAll<HTMLElement>("[data-shell-tail]");
  const last = tails?.[tails.length - 1];
  if (!last) return null;
  return last.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(last).marginTop) || 0);
}

/**
 * Fits a board to the viewport height as well as its width. `ideal` is the size the width allows (a cell or a
 * canvas height); while the page is taller than the viewport the size steps down (to `min` at most), so the
 * board, its own controls and the shell's tool bar fit without a vertical scroll. `unit` is how many px of
 * height one step adds (the row count for a cell size, 1 for a canvas). With `target`, only that element's
 * bottom (plus `margin`) has to fit, and the size grows back when there is room. With `margin` "shell" the
 * whole game shell has to fit, down to its tool bar (`shellContentBottom`), still measured from `target`. A
 * viewport resize starts again from `ideal`.
 */
export function useFitHeight(
  ideal: number,
  min: number,
  unit: number,
  target?: RefObject<HTMLElement | null>,
  margin: number | "shell" = 0,
): number {
  const [fit, setFit] = useState({ ideal, size: ideal });
  const size = fit.ideal === ideal ? fit.size : ideal;
  useLayoutEffect(() => {
    const measure = () => {
      const vh = window.innerHeight;
      let over: number;
      if (target) {
        const el = target.current;
        if (!el) return;
        const shellBottom = margin === "shell" ? shellContentBottom(el) : null;
        const bottom = shellBottom ?? el.getBoundingClientRect().bottom + (margin === "shell" ? 0 : margin);
        over = bottom + window.scrollY - vh;
      } else over = document.documentElement.scrollHeight - vh;
      const next = fitStep(size, ideal, min, unit, over, !!target);
      if (next !== size) setFit({ ideal, size: next });
    };
    const restart = () => setFit({ ideal, size: ideal });
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(document.body);
    // The feedback line and tool bar can change height while the page fits, which doesn't resize the body.
    if (margin === "shell")
      target?.current
        ?.closest("[data-shell]")
        ?.querySelectorAll("[data-shell-tail]")
        .forEach((t) => ro?.observe(t));
    window.addEventListener("resize", restart);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", restart);
    };
  }, [ideal, min, unit, target, margin, size]);
  return size;
}
