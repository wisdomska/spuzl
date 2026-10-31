/**
 * Shared timing rules for the Reflex Rink games (Echo, Twins, Flinch). Pure TypeScript.
 */

/** Nobody reacts to a visual change faster than this. Faster taps are anticipation or a bot. */
export const HUMAN_FLOOR_MS = 100;

/**
 * Photosensitivity cap (Handoff: flashing at most 2 Hz). A light is on for FLASH_ON_MS and off for
 * at least FLASH_OFF_MS, so one flash cycle never takes less than 500 ms.
 */
export const FLASH_ON_MS = 250;
export const FLASH_OFF_MS = 250;
export const FLASH_PERIOD_MS = FLASH_ON_MS + FLASH_OFF_MS;

/** Times are integer ms, strictly increasing, the first at least `floor` after zero and each gap at least `floor`. */
export function checkTapTimes(times: unknown[], floor = HUMAN_FLOOR_MS, maxGap = Infinity): string | null {
  let prev = 0;
  for (const t of times) {
    if (typeof t !== "number" || !Number.isInteger(t) || t < 0) return "malformed time";
    if (t - prev < floor) return "faster than the human floor";
    if (t - prev > maxGap) return "gap longer than the idle limit";
    prev = t;
  }
  return null;
}

/** Population standard deviation. */
export function stdev(xs: number[]) {
  if (!xs.length) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
