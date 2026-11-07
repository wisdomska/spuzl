"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePromptSlot } from "@/components/shell/PromptQueue";
import { track } from "@/lib/analytics/track";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { readDismissedAt, shouldAskToSave, writeDismissedAt } from "@/lib/client/save-streak";
import { guestCopy as T } from "@/lib/copy/guest";
import { EmailCodeSignIn } from "@/components/onboarding/EmailCodeSignIn";
import { Sheet } from "@/components/meta/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Guest safety net (SPZ-20): after the Nth clear (`guest.signInPromptAfterClears`, 0 = off) a guest sees
 * "Save your streak". "Save it" opens the email-code form in link mode, which adds the email to this same
 * anonymous account (progress kept). "Not now" hides it on this phone for a week.
 */
export function SaveStreakPrompt({ className = "" }: { className?: string }) {
  const me = useMe();
  const settings = useGameSettings();
  const qc = useQueryClient();
  // The stored dismissal is read on the client only (undefined on the server), so hydration agrees.
  const stored = useSyncExternalStore(subscribeStorage, readDismissedAt, () => undefined);
  const [dismissedNow, setDismissedNow] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<false | "plain" | "granted" | "full">(false);
  // R2-P5: the free streak shield is the reason to sign in (admin "features.streakShield").
  const shieldOn = settings["features.streakShield"];
  const dismissedAt = dismissedNow ?? stored;
  const ask =
    dismissedAt !== undefined &&
    shouldAskToSave({
      guest: me.data?.guest,
      clears: me.data?.clears,
      after: settings["guest.signInPromptAfterClears"],
      dismissedAt,
      now,
    });
  // One prompt per screen (R2-04): the card waits for the prompt queue; an open sign-in sheet keeps its slot.
  const granted = usePromptSlot("save_streak", !saved && (ask || open));
  useEffect(() => {
    if (granted) track("prompt_shown", { prompt: "save_streak", trigger: "clears" });
  }, [granted]);

  if (saved)
    return (
      <p role="status" className={`bg-surface flex items-center gap-2 rounded-[16px] px-3.5 py-3 text-[15px] font-semibold ${className}`}>
        <Icon name="check-circle" size={20} className="text-accent" />
        {saved === "granted" ? T.savedShield : saved === "full" ? T.savedShieldFull : T.saved}
      </p>
    );
  if (!granted) return null;

  const dismiss = () => {
    const at = Date.now();
    writeDismissedAt(at);
    setDismissedNow(at);
    track("prompt_dismissed", { prompt: "save_streak", trigger: "clears" });
  };

  return (
    <>
      <section
        aria-labelledby="save-streak-title"
        data-prompt="save_streak"
        className={`bg-surface flex flex-col gap-2.5 rounded-[18px] p-3.5 ${className}`}
        style={{ boxShadow: "inset 0 0 0 1px var(--line)" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="bg-surface-raised text-freeze flex size-10 shrink-0 items-center justify-center rounded-[12px]">
            <Icon name={shieldOn ? "shield-check" : "fire"} size={22} className={shieldOn ? undefined : "text-gold"} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="save-streak-title" className="font-display text-[16px] font-extrabold">
              {T.title}
            </h2>
            <p className="text-muted text-[14px] leading-snug">{(shieldOn ? T.shieldBody : T.body)(me.data?.clears ?? 0)}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={T.dismissAria}
            className="press text-muted -mt-1 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-[12px]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button icon={shieldOn ? "shield-check" : "envelope-simple"} onClick={() => setOpen(true)}>
            {shieldOn ? T.shieldSave : T.save}
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            {T.notNow}
          </Button>
        </div>
      </section>
      <Sheet open={open} onOpenChange={setOpen} title={T.sheetTitle} description={shieldOn ? T.shieldSheetBody : T.sheetBody}>
        <EmailCodeSignIn
          link
          autoFocus={false}
          googleNext={typeof window === "undefined" ? "/" : window.location.pathname}
          onDone={(_profile, shield) => {
            track("prompt_accepted", { prompt: "save_streak", trigger: "clears" });
            if (shield?.status === "granted") track("streak_shield", { status: "granted" });
            setOpen(false);
            setSaved(shield?.status === "granted" ? "granted" : shield?.status === "full" ? "full" : "plain");
            void qc.invalidateQueries({ queryKey: ["me"] });
          }}
        />
      </Sheet>
    </>
  );
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
