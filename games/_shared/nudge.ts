/**
 * Directional bump: the piece leans a few pixels toward what stopped it and springs back (a wall, a board
 * edge, a blocked slide). It reads as "can't go that way" where a side-to-side shake reads as "wrong".
 * Animates the individual `translate` property, which composes with an element's own `transform`, so a
 * piece positioned by transform can lean without losing its place. WAAPI, compositor-only, and a new bump
 * replaces the last one. Reduced motion skips it (the sound and the feedback line still say it).
 */
import { reducedMotion } from "./fly";

/** Direction vectors for 0 N, 1 E, 2 S, 3 W (games/_shared/grid.ts order). */
const VEC = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export const NUDGE_MS = 180;

export function nudgeKeyframes(dir: number, px: number): Keyframe[] {
  const [dx, dy] = VEC[((dir % 4) + 4) % 4];
  return [{ translate: "0px 0px" }, { translate: `${dx * px}px ${dy * px}px`, offset: 0.3 }, { translate: "0px 0px" }];
}

const running = new WeakMap<HTMLElement, Animation>();

export function nudge(el: HTMLElement | null, dir: number, px = 5) {
  if (!el || typeof el.animate !== "function" || reducedMotion()) return;
  running.get(el)?.cancel();
  running.set(el, el.animate(nudgeKeyframes(dir, px), { duration: NUDGE_MS, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }));
}
