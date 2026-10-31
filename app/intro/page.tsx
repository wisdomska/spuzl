"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Spuz } from "@/components/brand/Spuz";
import { play, unlock } from "@/lib/audio";
import { writeOnboarding } from "@/lib/client/onboarding";

/**
 * Logo intro, 2.2 s, tap to skip (Art Direction 01):
 *   0 to 700 ms     S P U L drop in, staggered 60 ms, squash 1.2 → 0.9 on landing
 *   700 to 1100 ms  Z slides in from the right and snaps into its notch: click + light haptic
 *   1100 to 1700 ms Spuz pops out of the Z with overshoot, lands, waves
 *   1700 to 2200 ms tagline fades up 8 px, then cross-fade onward
 * Reduced motion: everything fades in together.
 */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function Intro() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    writeOnboarding({ introSeen: true });
    setLeaving(true);
    setTimeout(() => router.replace("/welcome"), 220);
  }, [router]);

  useEffect(() => {
    const snap = setTimeout(() => play("tick"), 1080);
    const end = setTimeout(finish, 2600);
    return () => {
      clearTimeout(snap);
      clearTimeout(end);
    };
  }, [finish]);

  const skip = () => {
    unlock();
    if (skipped) return finish();
    setSkipped(true);
    setTimeout(finish, 350);
  };

  const instant = reduce || skipped;
  const letter = (i: number) =>
    instant
      ? { initial: false as const, animate: { opacity: 1, transform: "translateY(0px) scaleY(1)" } }
      : {
          // Opaque from the first paint (they only drop): the server-rendered letters count for LCP before hydration.
          initial: { opacity: 1, transform: "translateY(-60px) scaleY(1)" },
          animate: { opacity: 1, transform: ["translateY(-60px) scaleY(1.2)", "translateY(0px) scaleY(0.9)", "translateY(0px) scaleY(1)"] },
          transition: { duration: 0.46, delay: i * 0.06, ease: EASE_OUT, times: [0, 0.7, 1] },
        };

  return (
    <motion.main
      onPointerDown={skip}
      onKeyDown={skip}
      tabIndex={0}
      aria-label="SPUZL. Tiny games. Big brain. Tap to skip."
      className="bg-bg relative flex min-h-dvh flex-col items-center justify-center gap-2.5 overflow-hidden outline-none"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(var(--line) 1.5px, transparent 1.5px)", backgroundSize: "26px 26px" }}
      />
      <motion.div
        className="relative -mb-3.5"
        initial={instant ? false : { opacity: 0, transform: "translateY(60px) scale(0.6)" }}
        animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
        transition={instant ? { duration: 0 } : { delay: 1.1, type: "spring", stiffness: 300, damping: 12 }}
      >
        <Spuz mood="wave" size={170} decorative />
      </motion.div>
      <div
        className="font-display relative flex items-end font-black"
        style={{ fontSize: 72, lineHeight: 0.9, letterSpacing: "-0.05em" }}
        aria-hidden
      >
        {["S", "P", "U"].map((ch, i) => (
          <motion.span key={ch} className="inline-block origin-bottom" {...letter(i)}>
            {ch}
          </motion.span>
        ))}
        <motion.span
          className="text-accent relative inline-block"
          initial={instant ? false : { opacity: 0, transform: "translateX(160px) skewX(-10deg)" }}
          animate={{ opacity: 1, transform: "translateX(0px) skewX(-10deg)" }}
          transition={instant ? { duration: 0 } : { delay: 0.7, duration: 0.4, ease: [0.77, 0, 0.175, 1] }}
        >
          Z<span className="bg-accent absolute rounded-full" style={{ right: "-0.13em", top: "0.31em", width: "0.2em", height: "0.2em" }} />
        </motion.span>
        <motion.span className="inline-block origin-bottom" {...letter(3)}>
          L
        </motion.span>
      </div>
      <motion.p
        className="font-display text-muted relative text-[17px] font-bold"
        initial={instant ? false : { opacity: 0, transform: "translateY(8px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={instant ? { duration: 0 } : { delay: 1.7, duration: 0.5, ease: EASE_OUT }}
      >
        Tiny games. Big brain.
      </motion.p>
      <p className="text-muted absolute bottom-10 text-[15px] font-medium">Tap to skip</p>
    </motion.main>
  );
}
