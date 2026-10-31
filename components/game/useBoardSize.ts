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

function compute(vw: number, cols: number, gap: number, padding: number, max: number) {
  const avail = Math.min(vw, 420) - 36 - gap * (cols - 1) - padding;
  return Math.max(24, Math.min(max, Math.floor(avail / cols)));
}
