"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/lib/settings/store";
import { readAnswered, readConnectionHints, rememberAnswer, shouldSuggestLowData } from "@/lib/lowdata/suggest";
import { lowDataCopy as t } from "@/lib/copy/low-data";

/**
 * SPZ-27a: a one-time card above the bottom nav offering low-data mode on a slow connection.
 * Waits for the page load to finish so the measured load time is known. Either answer is remembered.
 */
export function LowDataSuggest() {
  const hydrated = useSettings((s) => s.hydrated);
  const lowData = useSettings((s) => s.lowData);
  const set = useSettings((s) => s.set);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const st = useSettings.getState();
      if (shouldSuggestLowData({ lowData: st.lowData, answered: readAnswered(), ...readConnectionHints() })) setShow(true);
    };
    if (document.readyState === "complete") {
      check();
      return;
    }
    window.addEventListener("load", check, { once: true });
    return () => window.removeEventListener("load", check);
  }, [hydrated]);

  if (!show || lowData) return null;

  const answer = (on: boolean) => {
    rememberAnswer(on ? "on" : "dismissed");
    if (on) set("lowData", true);
    setShow(false);
  };

  return (
    <section
      aria-label={t.label}
      role="status"
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
