/**
 * Same-page link glide for the public pages (owner, 12 Nov 2026): links like "#how" scroll to their section instead
 * of jumping. Done in script because a CSS `scroll-behavior` rule didn't survive the production CSS build.
 */

/** How long the glide takes for a distance in px: quick for short hops, never more than half a second. */
export function glideMs(distance: number): number {
  return Math.round(Math.min(500, Math.max(250, Math.abs(distance) / 5)));
}

/** Ease-in-out (cubic) for a move that starts and ends on screen. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** The scroll position that puts `el` at the top, after its own scroll-margin-top (room for the sticky nav). */
export function targetY(el: Element): number {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, Math.min(max, el.getBoundingClientRect().top + window.scrollY - margin));
}

const reduced = () => document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scrolls to `el`; reduced motion jumps. A wheel, touch or key from the player stops the glide where it is. */
export function glideTo(el: Element): void {
  const to = targetY(el);
  const from = window.scrollY;
  if (reduced() || Math.abs(to - from) < 2) {
    window.scrollTo({ top: to, behavior: "instant" });
    return;
  }
  const ms = glideMs(to - from);
  const start = performance.now();
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  const opts = { passive: true, once: true } as const;
  window.addEventListener("wheel", stop, opts);
  window.addEventListener("touchstart", stop, opts);
  window.addEventListener("keydown", stop, opts);
  const step = (now: number) => {
    if (stopped) return;
    const t = Math.min(1, (now - start) / ms);
    window.scrollTo({ top: from + (to - from) * easeInOut(t), behavior: "instant" });
    if (t < 1) requestAnimationFrame(step);
    else {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    }
  };
  requestAnimationFrame(step);
}
