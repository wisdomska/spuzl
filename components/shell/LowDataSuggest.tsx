"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/lib/settings/store";
import { useGameSettings } from "@/lib/game-settings/client";
import { track } from "@/lib/analytics/track";
import {
  lowDataTrigger,
  markAskedThisSession,
  parseSamples,
  readAskedThisSession,
  readConnectionHints,
  readSamplesRaw,
  shouldSuggestLowData,
  subscribeLoads,
} from "@/lib/lowdata/suggest";
import type { LowDataTrigger } from "@/lib/prompts/ids";
import { isQuietScreen } from "@/lib/prompts/queue";
import { lowDataCopy as t } from "@/lib/copy/low-data";
import { usePromptSlot } from "./PromptQueue";

/**
 * SPZ-27a, timing from R2-04: a card above the bottom nav offering low-data mode, only after measured slow loads
 * (`lib/lowdata/suggest.ts`), at most once a session, through the prompt queue. Never on Home (it would cover the
 * Continue card) or during play.
 */
export function LowDataSuggest() {
  const pathname = usePathname();
  const hydrated = useSettings((s) => s.hydrated);
  const lowData = useSettings((s) => s.lowData);
  const set = useSettings((s) => s.set);
  const settings = useGameSettings();
  const raw = useSyncExternalStore(subscribeLoads, readSamplesRaw, () => null);
  const samples = useMemo(() => parseSamples(raw), [raw]);
  // the trigger of the card on screen (kept while open: the session is marked asked as soon as it shows)
  const [showing, setShowing] = useState<LowDataTrigger | null>(null);
  const [asked, setAsked] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only; read after hydration
    setAsked(readAskedThisSession());
  }, []);

  const trigger = hydrated
    ? lowDataTrigger({
        samples,
        thresholdMs: settings["prompts.lowDataThresholdMs"],
        slowLoads: settings["prompts.lowDataSlowLoads"],
        effectiveType: readConnectionHints().effectiveType,
      })
    : null;
  const eligible = hydrated && !lowData && !isQuietScreen(pathname);
  const want = eligible && (showing !== null || shouldSuggestLowData({ lowData, askedThisSession: asked, trigger }));
  const granted = usePromptSlot("low_data", want);
  if (granted && showing === null && trigger !== null && !asked) setShowing(trigger);
  const open = granted && showing !== null;

  useEffect(() => {
    if (!open || !showing) return;
    markAskedThisSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the session flag just written
    setAsked(true);
    track("prompt_shown", { prompt: "low_data", trigger: showing });
  }, [open, showing]);

  if (!open) return null;

  const answer = (on: boolean) => {
    track(on ? "prompt_accepted" : "prompt_dismissed", { prompt: "low_data", trigger: showing });
    if (on) set("lowData", true);
    setShowing(null);
  };

  return (
    <section
      aria-label={t.label}
      role="status"
      data-prompt="low_data"
      className="bg-surface-raised border-line fixed inset-x-4 bottom-[calc(92px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[528px] flex-col gap-3 rounded-[20px] border p-4 lg:bottom-6 lg:left-[112px]"
    >
      <div className="flex items-start gap-3">
        <Icon name="cell-signal-low" size={24} className="text-accent mt-0.5 flex-none" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-[16px] leading-tight font-semibold">{t.suggestTitle}</h2>
          <p className="text-muted text-[14px]">{t.suggestBody}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => answer(false)}>
          {t.notNow}
        </Button>
        <Button className="flex-1" onClick={() => answer(true)}>
          {t.turnOn}
        </Button>
      </div>
    </section>
  );
}
