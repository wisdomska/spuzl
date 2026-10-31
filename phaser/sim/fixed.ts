/**
 * Fixed-point helpers for the Rage Ridge simulation.
 * Positions and velocities are integers in 1/256 px (Q8). Every operation is an integer add, multiply,
 * truncated divide or an exact integer square root, so a run replays bit-identically on every engine.
 */

/** Simulation step in ms: 60 Hz. */
export const STEP_MS = 1000 / 60;
export const FPS = 60;
/** Sub-units per pixel. */
export const FP = 256;
/** Tile size in pixels. */
export const TILE_PX = 16;
/** Tile size in sub-units. */
export const TILE = TILE_PX * FP;

/** Truncated integer division (toward zero). */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Exact floor(sqrt(n)) for non-negative safe integers. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Moves `v` toward `target` by at most `step`. */
export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

/** Frames to ms, rounded to whole ms (the value the client reports and the server recomputes). */
export function framesToMs(frames: number): number {
  return Math.round((frames * 1000) / 60);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
