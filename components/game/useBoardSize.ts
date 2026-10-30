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
  const avail = Math.min(vw, 420) - 32 - gap * (cols - 1) - padding;
  return Math.max(44, Math.min(max, Math.floor(avail / cols)));
}
