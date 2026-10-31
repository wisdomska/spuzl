/**
 * Dusk input model (client only; the server never sees transient marks). A tap advances a cell
 * empty → sun → moon → empty, so one tap is a sun and a double-tap is a moon. Taps on the same cell
 * inside the settle window form one burst; only the settled result is judged, so a cell passing
 * through sun on its way to moon never counts as a slip.
 */
import { analyze, EMPTY, MOON, SUN, type DuskPuzzle, type DuskState } from "./logic";

/** Taps on one cell closer together than this are one gesture (a double-tap). */
export const SETTLE_MS = 320;

export type Tool = "sun" | "moon" | null;

/** The mark one tap leaves on a cell holding `v`. With a tool, a tap places that mark or clears it. */
export function tapMark(v: number, tool: Tool): number {
  if (tool === "sun") return v === SUN ? EMPTY : SUN;
  if (tool === "moon") return v === MOON ? EMPTY : MOON;
  return (v + 1) % 3;
}

/**
 * Whether a settled change at `i` is a slip: the board after the settle is actually invalid at that
 * cell and the change added breaks that were not there before the gesture started.
 */
export function isSlip(p: DuskPuzzle, before: DuskState, after: DuskState, i: number): boolean {
  if (before[i] === after[i]) return false;
  const a = analyze(p, after);
  if (!a.bad.has(i)) return false;
  return a.bad.size > analyze(p, before).bad.size;
}
