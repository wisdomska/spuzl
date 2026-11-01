"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotionConfig } from "motion/react";
import { Spuz } from "@/components/brand/Spuz";
import { play, unlock } from "@/lib/audio";
import { writeOnboarding } from "@/lib/client/onboarding";
import { introCopy as T } from "@/lib/copy/intro";
import { EASE_IN_CUBIC, EASE_IN_OUT, EASE_OUT, FINISH_AT, introCues, LETTERS, SPUZ_AT, TAGLINE_AT, Z, zImpact } from "@/lib/motion/intro";

/**
 * Logo intro, 2.6 s, tap to skip (Art Direction 01). Timeline and sound cues live in lib/motion/intro.ts.
 * Sounds are scheduled on the audio clock from the same numbers as the keyframes, so the thump lands on
 * the Z's impact frame. Audio plays only if a gesture already unlocked it (the landing-page tap, in most
 * cases); the skip tap unlocks it for the rest of the app. Reduced motion: everything is in place at
 * once, with one soft thump.
 */
const LOOKAHEAD_MS = 60;
/** A cue that would land later than this behind its frame is dropped: a late sound is worse than none. */
const LATE_S = 0.08;

export default function Intro() {
  const router = useRouter();
  const reduce = !!useReducedMotionConfig();
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    writeOnboarding({ introSeen: true });
    setLeaving(true);
    setTimeout(() => router.replace("/welcome"), 220);
  }, [router]);

  useEffect(() => {
    const t0 = performance.now();
    const cues = introCues(reduce).map((c) =>
      setTimeout(
        () => {
          const lead = c.at - (performance.now() - t0) / 1000;
          if (lead < -LATE_S) return;
          play(c.event, { ...c.opts, delay: Math.max(0, lead) });
        },
        Math.max(0, c.at * 1000 - LOOKAHEAD_MS),
      ),
    );
    timers.current = cues;
    const end = setTimeout(finish, FINISH_AT * 1000);
    return () => {
      cues.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, [finish, reduce]);

  const skip = () => {
    unlock();
    timers.current.forEach(clearTimeout);
    if (skipped) return finish();
    setSkipped(true);
    setTimeout(finish, 350);
  };

  const instant = reduce || skipped;
  const still = { duration: 0 };

  const letter = (i: number) =>
    instant
      ? { initial: false as const, animate: { opacity: 1, transform: "translateY(0px) scaleY(1) scaleX(1)" }, transition: still }
      : {
          // Opaque from the first paint (they only drop): the server-rendered letters count for LCP before hydration.
          initial: { opacity: 1, transform: "translateY(-64px) scaleY(1.12) scaleX(0.94)" },
          // fall (gravity) → squash on contact → small rebound → settle
          animate: {
            opacity: 1,
            transform: [
              "translateY(-64px) scaleY(1.12) scaleX(0.94)",
              "translateY(0px) scaleY(0.84) scaleX(1.1)",
              "translateY(-5px) scaleY(1.04) scaleX(0.98)",
              "translateY(0px) scaleY(1) scaleX(1)",
            ],
          },
          transition: {
            duration: LETTERS.duration,
            delay: LETTERS.start + i * LETTERS.stagger,
            times: [0, LETTERS.contact, 0.82, 1],
            ease: [EASE_IN_CUBIC, EASE_OUT, EASE_IN_OUT],
          },
        };

  return (
    <motion.main
      onPointerDown={skip}
      onKeyDown={skip}
      tabIndex={0}
      aria-label={T.ariaLabel}
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
        initial={instant ? false : { opacity: 0, transform: "translateY(48px) scale(0.7)" }}
        animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
        transition={
          instant
            ? still
            : {
                // Playful, first-run only: the one place in the app with a lively bounce.
                transform: { delay: SPUZ_AT, type: "spring", stiffness: 420, damping: 15 },
                opacity: { delay: SPUZ_AT, duration: 0.12, ease: EASE_OUT },
              }
        }
      >
        <Spuz mood="wave" size={170} decorative />
      </motion.div>
      <motion.div
        className="font-display relative flex items-end font-black"
        style={{ fontSize: 72, lineHeight: 0.9, letterSpacing: "-0.05em" }}
        aria-hidden
        // The Z's impact travels through the whole wordmark: a 3 px dip and recover.
        animate={instant ? undefined : { transform: ["translateY(0px)", "translateY(3px)", "translateY(-1px)", "translateY(0px)"] }}
        transition={instant ? still : { delay: zImpact, duration: 0.24, times: [0, 0.25, 0.6, 1], ease: EASE_OUT }}
      >
        {["S", "P", "U"].map((ch, i) => (
          <motion.span key={ch} className="inline-block origin-bottom" {...letter(i)}>
            {ch}
          </motion.span>
        ))}
        <motion.span
          className="text-accent relative inline-block origin-bottom"
          initial={instant ? false : { opacity: 0, transform: "translateX(150px) skewX(-10deg) scaleX(1) scaleY(1)" }}
          // appear → pull back (anticipation) → slam left, leaning with speed → overshoot + squash → settle
          animate={{
            opacity: instant ? 1 : [0, 1, 1, 1, 1],
            transform: instant
              ? "translateX(0px) skewX(-10deg) scaleX(1) scaleY(1)"
              : [
                  "translateX(150px) skewX(-10deg) scaleX(1) scaleY(1)",
                  "translateX(172px) skewX(4deg) scaleX(1) scaleY(1)",
                  "translateX(0px) skewX(-24deg) scaleX(1.04) scaleY(0.96)",
                  "translateX(-8px) skewX(-2deg) scaleX(0.88) scaleY(1.1)",
                  "translateX(0px) skewX(-10deg) scaleX(1) scaleY(1)",
                ],
          }}
          transition={
            instant
              ? still
              : { delay: Z.start, duration: Z.duration, times: [...Z.times], ease: [EASE_OUT, EASE_IN_CUBIC, EASE_OUT, EASE_IN_OUT] }
          }
        >
          Z
          <motion.span
            className="bg-accent absolute rounded-full"
            style={{ right: "-0.13em", top: "0.31em", width: "0.2em", height: "0.2em" }}
            initial={instant ? false : { opacity: 0, transform: "scale(0.5)" }}
            animate={{ opacity: 1, transform: instant ? "scale(1)" : ["scale(0.5)", "scale(1.35)", "scale(1)"] }}
            transition={
              instant
                ? still
                : {
                    opacity: { delay: zImpact, duration: 0.06 },
                    transform: { delay: zImpact, duration: 0.32, times: [0, 0.45, 1], ease: [EASE_OUT, EASE_IN_OUT] },
                  }
            }
          />
        </motion.span>
        <motion.span className="inline-block origin-bottom" {...letter(3)}>
          L
        </motion.span>
      </motion.div>
      <motion.p
        className="font-display text-muted relative text-[17px] font-bold"
        initial={instant ? false : { opacity: 0, transform: "translateY(8px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={instant ? still : { delay: TAGLINE_AT, duration: 0.42, ease: EASE_OUT }}
      >
        {T.tagline}
      </motion.p>
      <p className="text-muted absolute bottom-10 text-[15px] font-medium">{T.skip}</p>
    </motion.main>
  );
}
