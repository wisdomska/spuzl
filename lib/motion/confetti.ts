/**
 * Confetti budget and layout (Handoff: "Low-data mode: confetti capped at 30 pieces").
 * Pure, so the results screen, Full Spuzl and the Party podium share one source of truth.
 */
import { createRng } from "@/lib/rng";

/** Hard cap in low-data mode. */
export const MAX_CONFETTI = 30;
/** Default burst for a clear (design results screens show 10 to 12 visible at a time, looping). */
export const DEFAULT_CONFETTI = 48;

export const CONFETTI_COLOURS = ["#B8F23A", "#FFC93C", "#8B7CFF", "#F4F5FB", "#2FD3E0", "#FF6B6B", "#FF8A3D"] as const;

/** How many pieces to draw: capped at MAX_CONFETTI in low-data mode, never negative. */
export function confettiCount(requested: number, opts: { lowData?: boolean } = {}): number {
  const n = Math.max(0, Math.floor(requested));
  return opts.lowData ? Math.min(n, MAX_CONFETTI) : n;
}

export interface ConfettiPiece {
  /** start position, % of the container width */
  x: number;
  /** horizontal drift over the fall, px */
  drift: number;
  /** start rotation and total spin, deg */
  rotate: number;
  spin: number;
  /** ms */
  delay: number;
  duration: number;
  w: number;
  h: number;
  round: boolean;
  color: string;
}

/** Deterministic pieces for a seed, so a replayed celebration looks the same and SSR matches. */
export function makeConfetti(count: number, seed = "spuzl", colours: readonly string[] = CONFETTI_COLOURS): ConfettiPiece[] {
  const rng = createRng(`confetti:${seed}`);
  const r = () => rng.next();
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    x: 4 + r() * 92,
    drift: (r() - 0.5) * 80,
    rotate: Math.floor(r() * 360),
    spin: 360 + Math.floor(r() * 360),
    delay: Math.floor(r() * 260 + (i % 4) * 40),
    duration: Math.floor(1600 + r() * 900),
    w: 8 + Math.floor(r() * 3),
    h: 12 + Math.floor(r() * 4),
    round: r() < 0.2,
    color: colours[i % colours.length],
  }));
}
