"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * Board sizing rule (Game Boards template): cell = floor((min(vw, 420) − 36 − gaps − padding) / cols),
 * capped at `max`. Boards always fit the screen width: big grids get smaller cells instead of a
 * sideways scroll (never below 24 px, the WCAG 2.5.8 minimum target).
 */
export function useCellSize(cols: number, gap: number, padding = 6, max = 64): number {
  return compute(useViewportWidth(), cols, gap, padding, max);
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

/**
 * Cell size with a floor for dense boards (Nine). `overhead` is every px across the board that is not a cell
 * (gaps, lines, padding). The roomy fit sits inside the shell's 18 px board padding (36 px in all, width
 * capped at `cap`). If that falls below `floor`, the board may also use that padding, edge to edge, to keep
 * `floor`; when even that does not fit (the narrowest phones) it takes the largest cell that fits, never
 * under 24 px (WCAG 2.5.8).
 */
export function fitCell(vw: number, cols: number, overhead: number, floor: number, max: number, cap = 560): number {
  const roomy = Math.floor((Math.min(vw, cap) - 36 - overhead) / cols);
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

function compute(vw: number, cols: number, gap: number, padding: number, max: number) {
  const avail = Math.min(vw, 420) - 36 - gap * (cols - 1) - padding;
  return Math.max(24, Math.min(max, Math.floor(avail / cols)));
}
