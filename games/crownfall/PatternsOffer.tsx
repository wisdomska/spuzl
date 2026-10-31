"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { useSettings } from "@/lib/settings/store";
import { CROWNFALL_COPY } from "@/lib/copy/crownfall";

export const PATTERNS_OFFERED_KEY = "spuzl.cfPatternsOffered";

/**
 * Decided once per page load: true when this is the player's first Crownfall (key unset). The key is
 * written as soon as we decide, so the offer shows on the first board only, whether or not it is answered.
 */
let firstBoard: boolean | null = null;
function isFirstBoard(): boolean {
  if (firstBoard !== null) return firstBoard;
  try {
    firstBoard = localStorage.getItem(PATTERNS_OFFERED_KEY) === null;
    if (firstBoard) localStorage.setItem(PATTERNS_OFFERED_KEY, "1");
  } catch {
    firstBoard = false; // storage blocked: never nag
  }
  return firstBoard;
}

const noopSubscribe = () => () => {};

/** One-tap inline offer to turn on colour-blind patterns, shown under the first Crownfall board. */
export function PatternsOffer({ onAccepted }: { onAccepted?: (text: string) => void }) {
  const first = useSyncExternalStore(noopSubscribe, isFirstBoard, () => false);
  const hydrated = useSettings((s) => s.hydrated);
  const cb = useSettings((s) => s.cb);
  const set = useSettings((s) => s.set);
  const [closed, setClosed] = useState(false);
  // Players who already use a colour-blind mode have patterns on; nothing to offer.
  if (!first || closed || !hydrated || cb !== "off") return null;
  const T = CROWNFALL_COPY.patternsOffer;
  return (
    <section
      aria-labelledby="cf-patterns-title"
      className="bg-surface-raised flex w-full max-w-[420px] items-center gap-3 rounded-[16px] p-3"
    >
      <Icon name="eye" size={24} className="text-muted shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h2 id="cf-patterns-title" className="font-display text-[16px] font-extrabold">
            {T.title}
          </h2>
          <p className="text-muted text-[14px] leading-snug">{T.body}</p>
        </div>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            set("cb", "deutan");
            setClosed(true);
            onAccepted?.(T.accepted);
          }}
        >
          {T.accept}
        </Button>
      </div>
      <IconButton icon="x" label={T.dismiss} onClick={() => setClosed(true)} className="self-start" />
    </section>
  );
}
