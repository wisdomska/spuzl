"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings, prefersReducedMotion } from "@/lib/settings/store";
import { DEFAULT_CONFETTI, confettiCount, makeConfetti } from "@/lib/motion/confetti";

/**
 * Celebration confetti (Handoff: z celebration 70; "Celebrations skip on tap").
 *
 *   <Confetti play={cleared} seed={attemptId} onDone={...} />
 *
 * - transform and opacity only, via WAAPI, so the fall stays on the compositor while results load;
 *   the fall is linear (constant motion), the skip fade is ease-out.
 * - Low-data mode caps the burst at MAX_CONFETTI (30).
 * - Reduced motion: no falling or spinning; a few pieces fade in place and out.
 * - Skippable: a tap or key press anywhere (or `skip`) fades it out in 150 ms. Never blocks input:
 *   the layer is pointer-events none and the skip listener is passive.
 */
export function Confetti({
  play = true,
  count = DEFAULT_CONFETTI,
  seed = "clear",
  skip,
  onDone,
  className = "",
}: {
  play?: boolean;
  count?: number;
  seed?: string;
  /** set true to end early (for example when the player taps Continue) */
  skip?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const lowData = useSettings((s) => s.lowData);
  const reducedSetting = useSettings((s) => s.reducedMotion);
  const hydrated = useSettings((s) => s.hydrated);
  const reduce = hydrated && prefersReducedMotion({ reducedMotion: reducedSetting });
  const n = reduce ? Math.min(8, confettiCount(count, { lowData })) : confettiCount(count, { lowData });
  const pieces = useMemo(() => makeConfetti(n, seed), [n, seed]);
  const layer = useRef<HTMLDivElement>(null);
  // A celebration is identified by its seed: a new seed plays again.
  const [doneSeed, setDoneSeed] = useState<string | null>(null);
  const done = doneSeed === seed;
  const doneRef = useRef(onDone);
  const skipRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const el = layer.current;
    if (!play || done || !el) return;
    const height = el.getBoundingClientRect().height || window.innerHeight;
    const animations: Animation[] = [];
    const nodes = Array.from(el.children) as HTMLElement[];
    nodes.forEach((node, i) => {
      const p = pieces[i];
      if (!p) return;
      const frames: Keyframe[] = reduce
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
        : [
            { transform: `translate3d(0, -24px, 0) rotate(${p.rotate}deg)`, opacity: 1 },
            { transform: `translate3d(${p.drift}px, ${height + 24}px, 0) rotate(${p.rotate + p.spin}deg)`, opacity: 1, offset: 0.85 },
            { transform: `translate3d(${p.drift * 1.1}px, ${height + 48}px, 0) rotate(${p.rotate + p.spin * 1.1}deg)`, opacity: 0 },
          ];
      animations.push(
        node.animate(frames, {
          duration: reduce ? 900 : p.duration,
          delay: reduce ? (i % 4) * 60 : p.delay,
          easing: "linear",
          fill: "both",
        }),
      );
    });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setDoneSeed(seed);
      doneRef.current?.();
    };
    Promise.all(animations.map((a) => a.finished)).then(finish, () => undefined);

    const skipNow = () => {
      for (const a of animations) a.pause();
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 150,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "forwards",
      }).finished.then(
        () => {
          for (const a of animations) a.cancel();
          finish();
        },
        () => undefined,
      );
    };
    window.addEventListener("pointerdown", skipNow, { once: true, passive: true });
    window.addEventListener("keydown", skipNow, { once: true });
    skipRef.current = skipNow;
    return () => {
      skipRef.current = null;
      window.removeEventListener("pointerdown", skipNow);
      window.removeEventListener("keydown", skipNow);
      for (const a of animations) a.cancel();
    };
  }, [play, done, pieces, reduce, seed]);

  useEffect(() => {
    if (skip) skipRef.current?.();
  }, [skip]);

  if (!play || done || n === 0) return null;
  return (
    <div
      ref={layer}
      aria-hidden
      data-confetti={n}
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`}
      style={{ zIndex: "var(--z-celebration)" }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.x}%`,
            top: reduce ? `${10 + ((i * 37) % 60)}%` : 0,
            width: p.w,
            height: p.round ? p.w : p.h,
            borderRadius: p.round ? "50%" : 2,
            background: p.color,
            opacity: 0,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}
