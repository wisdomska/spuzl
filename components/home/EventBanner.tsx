"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { EVENT_ACCENTS } from "@/lib/events";
import { eventsCopy as T } from "@/lib/copy/events";
import { track } from "@/lib/analytics/track";
import { usePromptSlot } from "@/components/shell/PromptQueue";

interface CurrentEvent {
  event: { id: string; name: string; endsAt: string; accent: string; banner: string } | null;
}

const KEY = "spuzl.eventBannerDismissed";
const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/**
 * Home banner for a live seasonal event (admin setting "features.seasonal"): the admin's banner copy with the
 * event's accent token, a link to the bonus quest, and a dismiss button remembered per event on this device.
 * Renders nothing while the setting is off or no event is live (the API answers null then too).
 */
export function EventBanner() {
  const on = useGameSettings()["features.seasonal"];
  const reduce = useReducedMotion();
  const q = useQuery({
    queryKey: ["event-current"],
    queryFn: () => api<CurrentEvent>("/api/v1/events/current"),
    enabled: on,
    staleTime: 5 * 60_000,
  });
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; read after hydration
    setDismissed(readDismissed());
  }, []);
  const e = on ? q.data?.event : null;
  // Through the prompt queue (R2-04), lowest priority: on a screen visit another prompt holds, it waits for the next.
  const show = usePromptSlot("event", !!e && dismissed !== e.id);
  useEffect(() => {
    if (show) track("prompt_shown", { prompt: "event", trigger: "live" });
  }, [show]);
  const accent = e && (EVENT_ACCENTS as readonly string[]).includes(e.accent) ? `var(--${e.accent})` : "var(--accent)";
  const dismiss = () => {
    if (!e) return;
    track("prompt_dismissed", { prompt: "event", trigger: "live" });
    setDismissed(e.id);
    try {
      localStorage.setItem(KEY, e.id);
    } catch {
      /* private mode: dismissed for this visit only */
    }
  };
  return (
    <AnimatePresence initial={false}>
      {show && e && (
        <motion.aside
          key={e.id}
          aria-label={T.bannerLabel(e.name)}
          data-testid="event-banner"
          data-prompt="event"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="bg-surface-raised text-text flex min-h-12 items-center gap-2.5 rounded-[16px] py-1 pr-1 pl-3.5 text-[15px] leading-snug font-medium"
          style={{ boxShadow: `inset 4px 0 0 ${accent}` }}
        >
          <Icon name="confetti" size={20} style={{ color: accent, flex: "none" }} />
          <p className="min-w-0 flex-1 py-2">
            <span className="font-bold">{e.name}</span> · {e.banner}
          </p>
          <Link
            href="/quests"
            onClick={() => track("prompt_accepted", { prompt: "event", trigger: "live" })}
            className="press text-accent flex min-h-11 shrink-0 items-center rounded-[12px] px-3 text-[14px] font-semibold"
          >
            {T.bannerAction}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="press text-muted flex size-11 shrink-0 items-center justify-center rounded-[12px]"
          >
            <Icon name="x" size={18} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
