"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { Me } from "@/lib/client/api";
import type { FriendsRes } from "@/lib/client/social";
import { alertsSupported, askAlerts } from "@/lib/client/alerts";
import { useGameSettings } from "@/lib/game-settings/client";
import { track } from "@/lib/analytics/track";
import {
  alertsStateFrom,
  dueTrigger,
  noteAlertsAsked,
  noteAlertsTrigger,
  readAlertsRaw,
  streakReached,
  subscribeAlerts,
} from "@/lib/prompts/alerts";
import type { AlertsTrigger } from "@/lib/prompts/ids";
import { isQuietScreen } from "@/lib/prompts/queue";
import { promptsCopy } from "@/lib/copy/prompts";
import { usePromptSlot } from "./PromptQueue";

const T = promptsCopy.alerts;

/** Permission is read while rendering; "default" is the only state worth asking in. */
const permissionDefault = () => alertsSupported() && Notification.permission === "default";

/**
 * The notification ask (R2-04): "Know when it's your turn", only after a moment that earns it (first friend, first
 * Duel or Party invite, a streak; `lib/prompts/alerts.ts`), through the prompt queue, never on Home or during play.
 * Turn on asks the browser and turns on push for this device; Not now waits `prompts.alertsCooldownDays`.
 * Settings > Alerts stays the manual switch, any time.
 */
export function AlertsAsk({ me, pathname }: { me: Me | null; pathname: string }) {
  const settings = useGameSettings();
  const qc = useQueryClient();
  const streakDays = settings["prompts.alertsStreakDays"];
  const raw = useSyncExternalStore(subscribeAlerts, readAlertsRaw, () => null);
  const stored = useMemo(() => alertsStateFrom(raw), [raw]);
  const [now, setNow] = useState(0);
  // the trigger of the ask on screen (kept while it is open, so the card doesn't vanish once the ask is recorded)
  const [showing, setShowing] = useState<AlertsTrigger | null>(null);

  // What the server already knows: the streak, and friends (whenever any screen has loaded the friends list).
  const streak = me?.streak.current;
  useEffect(() => {
    if (me && streakReached(streak, streakDays)) noteAlertsTrigger("streak");
  }, [me, streak, streakDays]);
  useEffect(() => {
    if (!me) return;
    const check = () => {
      const d = qc.getQueryData<FriendsRes>(["friends"]);
      if (d && d.friends.length > 0) noteAlertsTrigger("friend");
    };
    check();
    return qc.getQueryCache().subscribe((e) => {
      if (e.query.queryKey.length === 1 && e.query.queryKey[0] === "friends") check();
    });
  }, [me, qc]);

  // The clock is read after hydration and on each screen (page.clock-friendly in tests).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is client-only; read after hydration
    setNow(Date.now());
  }, [pathname, raw]);

  const eligible = !!me && now > 0 && !isQuietScreen(pathname) && permissionDefault();
  const due = eligible
    ? dueTrigger(stored, { enabled: settings["prompts.alertsTriggers"], cooldownDays: settings["prompts.alertsCooldownDays"], now })
    : null;
  const granted = usePromptSlot("alerts", eligible && (showing !== null || due !== null));
  if (granted && showing === null && due !== null) setShowing(due);
  const open = granted && showing !== null;

  // Shown: the ask counts from now (cooldown), once per showing.
  useEffect(() => {
    if (!open || !showing) return;
    noteAlertsAsked();
    track("prompt_shown", { prompt: "alerts", trigger: showing });
  }, [open, showing]);

  const answer = (yes: boolean) => {
    if (showing) track(yes ? "prompt_accepted" : "prompt_dismissed", { prompt: "alerts", trigger: showing });
    setShowing(null);
    if (yes) void askAlerts();
  };

  const body = showing === "streak" ? T.body.streak(Math.max(streak ?? 0, streakDays)) : showing ? T.body[showing] : "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label={T.label}
          data-prompt="alerts"
          className="bg-surface-raised fixed inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-[480px] flex-col gap-3 rounded-[20px] p-4 shadow-[0_14px_40px_rgba(0,0,0,.45)]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex items-center gap-3">
            <span className="bg-accent text-on-accent flex size-11 flex-none items-center justify-center rounded-[14px]">
              <Icon name="bell-ringing" size={22} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-[16px] font-black">{T.title}</span>
              <span className="text-muted text-[14px]">{body}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => answer(false)} className="press bg-surface h-11 rounded-[14px] text-[15px] font-semibold">
              {T.notNow}
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className="press bg-accent text-on-accent font-display h-11 rounded-[14px] text-[15px] font-black"
            >
              {T.turnOn}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
