"use client";

import { useState, useSyncExternalStore } from "react";
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
  // One slim line, so the board and its tools still fit a short phone on the first visit.
  return (
    <section
      aria-labelledby="cf-patterns-title"
      className="bg-surface-raised flex w-full max-w-[420px] items-center gap-2 rounded-[14px] py-1 pr-1 pl-3"
    >
      <Icon name="eye" size={18} className="text-muted shrink-0" />
      <h2 id="cf-patterns-title" className="min-w-0 flex-1 text-[14px] leading-tight font-semibold">
        {T.title}
        <span className="sr-only"> {T.body}</span>
      </h2>
      <button
        type="button"
        className="text-accent h-11 shrink-0 px-2 text-[14px] font-bold"
        onClick={() => {
          set("cb", "deutan");
          setClosed(true);
          onAccepted?.(T.accepted);
        }}
      >
        {T.acceptShort}
      </button>
      <IconButton icon="x" label={T.dismiss} onClick={() => setClosed(true)} className="shrink-0" />
    </section>
  );
}
