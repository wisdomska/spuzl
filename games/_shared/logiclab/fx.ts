/**
 * Shared board motion helpers for Logic Lab boards (Handoff motion spec).
 * Clear wave: tiles flip to the world colour with a 70 ms × Manhattan-distance delay from the last move.
 * Reduced motion swaps the flip for a short cross-fade. Transform and opacity only.
 */
import type { CSSProperties } from "react";

export const WAVE_STEP_MS = 70;

export function reducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.motion === "reduce";
}

/** Style for the overlay span that flips a cell into its cleared colour. */
export function waveStyle(dist: number, background: string, radius = 10): CSSProperties {
  const delay = dist * WAVE_STEP_MS;
  return {
    background,
    borderRadius: radius,
    animation: reducedMotion()
      ? `fade-in 200ms linear ${Math.min(delay, 400)}ms both`
      : `cell-flip 500ms var(--ease-out) ${delay}ms both, fade-in 1ms linear ${delay + 250}ms both`,
  };
}

/** Alternating class names so the same animation restarts on every tap. */
export const popClass = (n: number) => (n % 2 ? "cell-pop-a" : "cell-pop-b");
export const shakeClass = (n: number) => (n % 2 ? "cell-shake-a" : "cell-shake-b");

export function rc(i: number, cols: number): [number, number] {
  return [Math.floor(i / cols), i % cols];
}
