"use client";

import { useEffect, useState } from "react";

/**
 * Board sizing rule (Game Boards template): cell = floor((min(vw, 420) − 36 − gaps − padding) / cols),
 * capped at `max`. Boards always fit the screen width: big grids get smaller cells instead of a
 * sideways scroll (never below 24 px, the WCAG 2.5.8 minimum target).
 */
export function useCellSize(cols: number, gap: number, padding = 6, max = 64): number {
  const [cell, setCell] = useState(() => compute(390, cols, gap, padding, max));
  useEffect(() => {
    const on = () => setCell(compute(window.innerWidth, cols, gap, padding, max));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [cols, gap, padding, max]);
  return cell;
}

/** Viewport width in px, kept current on resize (390 before mount). */
export function useViewportWidth(): number {
  const [vw, setVw] = useState(390);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vw;
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

function compute(vw: number, cols: number, gap: number, padding: number, max: number) {
  const avail = Math.min(vw, 420) - 36 - gap * (cols - 1) - padding;
  return Math.max(24, Math.min(max, Math.floor(avail / cols)));
}
