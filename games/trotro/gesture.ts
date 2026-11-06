/**
 * Trotro Jam drag and swipe (R2-11): how far a vehicle slides when the finger or mouse lets go. Pure, so the
 * board and its tests share it.
 */

/** A swipe this long (px) along the lane moves the vehicle at least one space, even short of half a cell. */
export const SWIPE_MIN = 18;

/**
 * Spaces to slide for a release `px` along the lane (already clamped to the vehicle's room), with `pitch` px per
 * space: the nearest space, or one space the swipe's way for a short swipe. 0 when cancelled.
 */
export function slideSteps(px: number, pitch: number, cancel = false): number {
  if (cancel || !Number.isFinite(px) || pitch <= 0) return 0;
  const steps = Math.round(px / pitch);
  if (steps) return steps;
  return Math.abs(px) >= SWIPE_MIN ? Math.sign(px) : 0;
}
