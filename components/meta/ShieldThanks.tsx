"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { track } from "@/lib/analytics/track";
import { guestCopy as T } from "@/lib/copy/guest";
import { EASE_OUT } from "@/lib/motion/intro";

/** How long the thank-you stays up. */
const SHOW_MS = 4000;

/**
 * R4-05: linking Google from "Save your streak" leaves the app for Google and comes back through /auth/callback,
 * which grants the streak shield and adds `?shield=1` to the return page. This thanks the player there, the way the
 * email path thanks them in the card (and counts the same metrics), then strips the param so a reload or a shared
 * link never thanks twice. Mounted once for the whole app (Providers); renders nothing without the param.
 */
export function ShieldThanks() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("shield") !== "1") return;
    url.searchParams.delete("shield");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    track("prompt_accepted", { prompt: "save_streak", trigger: "clears" });
    track("streak_shield", { status: "granted" });
    // Shown from a timer callback (the URL is outside React), then hidden again. Not cancelled on cleanup: the
    // param is already gone, so a re-run (Strict Mode, a navigation) would never show it again.
    setTimeout(() => setShow(true), 0);
    setTimeout(() => setShow(false), SHOW_MS);
  }, [pathname]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]"
      aria-live="polite"
    >
      <AnimatePresence>
        {show && (
          <motion.p
            key="shield-thanks"
            role="status"
            data-testid="shield-thanks"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-20px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.15 } }
                : { opacity: 0, transform: "translateY(-12px)", transition: { duration: 0.15 } }
            }
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="bg-surface-raised flex w-full max-w-[400px] items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.4)]"
          >
            <Icon name="shield-check" size={20} className="text-accent shrink-0" />
            {T.savedShield}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
