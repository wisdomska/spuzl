"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Banner } from "@/components/notify/Banner";
import { onSynced, useOnlineStatus, usePendingCount } from "@/lib/offline/queue";

/**
 * Offline banner (Onboarding and Overlays G1; States "Offline · Home").
 *
 *   <OfflineBanner floating />         in a game: "Offline. Keep solving, we'll sync your time."
 *   <OfflineBanner context="home" />   elsewhere: "Offline. Times sync when you're back."
 *
 * Back online with clears waiting, it reads "Back online. Syncing your times." and then
 * "Times synced." for a moment once the queue drains. Toast layer (z 60), polite live region.
 */
const COPY = {
  game: "Offline. Keep solving, we'll sync your time.",
  home: "Offline. Times sync when you're back.",
};

export function OfflineBanner({
  context = "game",
  floating,
  className = "",
}: {
  context?: "game" | "home";
  /** pin over the screen under the top bar (G1: 12 px sides, 52 px down) on the toast layer */
  floating?: boolean;
  className?: string;
}) {
  const online = useOnlineStatus();
  const pending = usePendingCount();
  const reduce = useReducedMotion();
  const [synced, setSynced] = useState(0);

  useEffect(
    () =>
      onSynced(() => {
        setSynced((n) => n + 1);
      }),
    [],
  );
  useEffect(() => {
    if (!synced) return;
    const t = window.setTimeout(() => setSynced(0), 2500);
    return () => window.clearTimeout(t);
  }, [synced]);

  const state = !online ? "offline" : pending > 0 ? "syncing" : synced > 0 ? "synced" : null;
  const from = reduce ? "translateY(0px)" : "translateY(-8px)";

  return (
    <div
      className={`pointer-events-none ${floating ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+52px)] mx-auto max-w-[560px]" : ""} ${className}`}
      style={floating ? { zIndex: "var(--z-toast)" } : undefined}
    >
      <AnimatePresence initial={false}>
        {state && (
          <motion.div
            key="offline-banner"
            className="pointer-events-auto"
            initial={{ opacity: 0, transform: from }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: from, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <Banner
              compact
              testId="offline-banner"
              tone={state === "synced" ? "success" : "warn"}
              icon={state === "offline" ? "wifi-slash" : state === "syncing" ? "arrows-clockwise" : "check"}
              text={state === "offline" ? COPY[context] : state === "syncing" ? "Back online. Syncing your times." : "Times synced."}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
