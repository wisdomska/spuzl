"use client";

import { useEffect, useState } from "react";

/**
 * Board sizing rule (Game Boards template): cell = floor((min(vw, 420) − 32 − gaps − padding) / cols),
 * never below 44 px. Grids that would go below 44 pan horizontally instead of shrinking.
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
  // 44 px cells everywhere a 7-wide board fits; on the narrowest phones (320 px) a 36 px floor keeps
  // the board on screen (still well above the 24 px WCAG 2.5.8 minimum target).
  const floor = vw < 360 ? 36 : 44;
  return Math.max(floor, Math.min(max, Math.floor(avail / cols)));
}
