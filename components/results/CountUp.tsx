"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * A number that counts up from 0 with a strong ease-out. Writes textContent straight from
 * requestAnimationFrame, so the screen around it never re-renders per frame.
 * `instant` (reduced motion or a skip tap) shows the final value at once.
 */
export function CountUp({
  value,
  format,
  instant,
  duration = 900,
  className,
}: {
  value: number;
  format: (n: number) => string;
  instant: boolean;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = useRef(format);
  useLayoutEffect(() => {
    fmt.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Update React's own text node, so a later render still finds it.
    const write = (text: string) => {
      if (el.firstChild) el.firstChild.nodeValue = text;
      else el.textContent = text;
    };
    if (instant) {
      write(fmt.current(value));
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      write(fmt.current(value * countEase(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, instant, duration]);

  return (
    <span ref={ref} className={className}>
      {format(instant ? value : 0)}
    </span>
  );
}

/** easeOutCubic: fast start so the count feels immediate, gentle landing on the final value. */
export const countEase = (p: number) => 1 - Math.pow(1 - p, 3);
