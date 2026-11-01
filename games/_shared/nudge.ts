/**
 * Directional bump: the piece leans a few pixels toward what stopped it and springs back (a wall, a board
 * edge, a blocked slide). It reads as "can't go that way" where a side-to-side shake reads as "wrong".
 * WAAPI on transform only, so it runs off the main thread and a new bump simply replaces the last one.
 * Reduced motion skips it (the sound and the feedback line still say it).
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
  return [
    { transform: "translate(0px, 0px)" },
    { transform: `translate(${dx * px}px, ${dy * px}px)`, offset: 0.3 },
    { transform: "translate(0px, 0px)" },
  ];
}

export function nudge(el: HTMLElement | null, dir: number, px = 5) {
  if (!el || typeof el.animate !== "function" || reducedMotion()) return;
  el.getAnimations?.().forEach((a) => a.cancel());
  el.animate(nudgeKeyframes(dir, px), { duration: NUDGE_MS, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
}
