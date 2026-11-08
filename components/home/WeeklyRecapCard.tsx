"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ShareSheet } from "@/components/share/ShareSheet";
import { usePromptSlot } from "@/components/shell/PromptQueue";
import { api } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { track } from "@/lib/analytics/track";
import { markShown, readShownWeek, recapDue, recapWeeks, weekLabels, type WeeklyRecap } from "@/lib/recap/weekly";
import type { RecapStat } from "@/lib/share/recap-card";
import { weeklyRecapCopy as T } from "@/lib/copy/weekly-recap";

interface RecapRes {
  thisWeek: string;
  week: string;
  recap: WeeklyRecap | null;
  stats: RecapStat[];
  card: { image: string; width: number; height: number; text: string; alt: string } | null;
}

const STAT_ICON: Record<RecapStat["id"], string> = { best: "timer", streak: "fire", league: "trophy", sparks: "sparkle" };
const PROMPT = { prompt: "weekly_recap", trigger: "week" } as const;

/**
 * Weekly recap (R3-10, admin setting "weeklyRecap.enabled"): on the first Home visit of a GMT week, last week's
 * clears, best time, streak, league result and Sparks, with Share my week (the story card image) and Play today's
 * Daily. Through the prompt queue (`weekly_recap`), so never next to another prompt; on Home only, never on play
 * screens. Shown once a week (remembered on this device) and dismissible. The recap is fetched only while it is due.
 */
export function WeeklyRecapCard() {
  const settings = useGameSettings();
  const on = settings["weeklyRecap.enabled"];
  const reduce = useReducedMotion();
  // Clock and storage are client-only: read after hydration.
  const [now, setNow] = useState<Date | null>(null);
  const [shownWeek, setShownWeek] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock and localStorage are client-only
    setNow(new Date());
    setShownWeek(readShownWeek());
  }, []);
  const thisWeek = now ? recapWeeks(now).thisWeek : null;
  const notSeen = !!thisWeek && shownWeek !== thisWeek;
  const q = useQuery({
    queryKey: ["weekly-recap", thisWeek],
    queryFn: () => api<RecapRes>("/api/v1/me/weekly-recap"),
    enabled: on && notSeen,
    staleTime: 10 * 60_000,
  });
  // Open while on screen: once shown it is marked seen, but stays until dismissed or the player leaves Home.
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const due = !!now && recapDue({ enabled: on, shownWeek, now, recap: q.data?.recap });
  const granted = usePromptSlot("weekly_recap", !closed && (open || due));
  if (granted && !open && due) setOpen(true);
  const show = granted && open && !!q.data?.recap;

  useEffect(() => {
    if (!show || !thisWeek) return;
    markShown(thisWeek);
    track("prompt_shown", PROMPT);
  }, [show, thisWeek]);

  const dismiss = () => {
    track("prompt_dismissed", PROMPT);
    setClosed(true);
    setOpen(false);
  };

  const d = q.data;
  const playHref = settings["dailyFive.enabled"] ? "/daily" : "/library";
  const range = d ? weekLabels(d.week) : null;
  return (
    <>
      <AnimatePresence initial={false}>
        {show && d?.recap && (
          <motion.section
            key="weekly-recap"
            aria-label={T.label}
            data-testid="weekly-recap"
            data-prompt="weekly_recap"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="bg-surface-raised text-text flex flex-col gap-3 rounded-[20px] p-4"
            style={{ boxShadow: "inset 0 0 0 2px var(--accent)" }}
          >
            <div className="flex items-start gap-3">
              <span className="bg-accent text-on-accent flex size-11 flex-none items-center justify-center rounded-[14px]">
                <Icon name="calendar-blank" size={22} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="font-display text-[16px] font-black">{T.title}</h2>
                {range && <p className="text-muted text-[14px]">{T.range(range.from, range.to)}</p>}
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label={T.dismiss}
                className="press text-muted -mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-[12px]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <p className="font-display text-[24px] leading-tight font-black">
              <span className="num text-accent">{d.recap.cleared}</span> {T.bigLine(d.recap.cleared)}
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {d.stats.map((s) => (
                <li
                  key={s.id}
                  className={`bg-surface flex flex-col gap-0.5 rounded-[14px] px-3 py-2 ${s.id === "best" ? "col-span-2" : ""}`}
                >
                  <span className="text-muted flex items-center gap-1.5 text-[13px] font-medium">
                    <Icon name={STAT_ICON[s.id]} size={14} />
                    {s.label}
                  </span>
                  <span className="num text-[15px] font-semibold">{s.value.replace("🔥 ", "")}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2">
              {d.card && (
                <Button variant="secondary" icon="share-fat" onClick={() => setSharing(true)}>
                  {T.share}
                </Button>
              )}
              <Link
                href={playHref}
                onClick={() => track("prompt_accepted", PROMPT)}
                className={`press bg-accent text-on-accent font-display flex h-12 items-center justify-center rounded-[16px] px-4 text-center text-[15px] leading-tight font-extrabold ${d.card ? "" : "col-span-2"}`}
              >
                {settings["dailyFive.enabled"] ? T.play : T.playAll}
              </Link>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      {d?.card && (
        <ShareSheet
          open={sharing}
          onOpenChange={setSharing}
          kind="recap"
          title={T.sheetTitle}
          text={d.card.text}
          image={d.card.image}
          fileName="spuzl-my-week.png"
          preview={{ width: 108, height: 192, alt: T.previewAlt }}
        />
      )}
    </>
  );
}
