"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { GameMeta } from "@/lib/catalog";
import { api } from "@/lib/client/api";
import { createChallengeLink } from "@/lib/client/challenge";
import { useGameSettings } from "@/lib/game-settings/client";
import { challengeCopy } from "@/lib/copy/challenge";
import { storyCopy } from "@/lib/copy/share";
import { cardUrl } from "@/lib/share/urls";
import { ShareSheet } from "./ShareSheet";

/** POST /api/v1/share/story answer. */
export interface StoryShare {
  code: string;
  path: string;
  image: string;
  width: number;
  height: number;
  text: string;
  alt: string;
}

type Shape = "story" | "square";

/**
 * Sharing a clear (R2-P5): the 9:16 story card (admin "features.storyCards") with the player's hatted Spuz, the
 * result and a "Beat me" short link to a challenge on the same puzzle, made on the server when they share.
 * Daily and archive clears keep their older Daily card as a Square choice (and as the whole sheet while story
 * cards are off). "Beat my time" (admin "features.challenges") sends the challenge link straight away.
 *
 *   const share = useClearShare({ meta, attemptId, cleared, daily, dailyText, onNotice });
 *   share.open()  share.beat  share.sheet  share.busy
 */
export function useClearShare({
  meta,
  attemptId,
  cleared,
  daily,
  dailyText,
  onNotice,
}: {
  meta: GameMeta;
  attemptId: string | null;
  /** a verified clear (the server refuses anything else) */
  cleared: boolean;
  /** a Daily or archive clear: the older Daily card exists for it */
  daily: boolean;
  dailyText: string;
  onNotice: (text: string) => void;
}) {
  const settings = useGameSettings();
  const challengesOn = settings["features.challenges"];
  const storyOn = settings["features.storyCards"] && challengesOn;
  const [isOpen, setOpen] = useState(false);
  const [story, setStory] = useState<(StoryShare & { attemptId: string }) | null>(null);
  const [shape, setShape] = useState<Shape>("story");
  const [busy, setBusy] = useState(false);
  const mine = story && story.attemptId === attemptId ? story : null;
  const canStory = storyOn && cleared && !!attemptId;

  const open = useCallback(async () => {
    if (canStory && !mine && attemptId) {
      setBusy(true);
      try {
        const s = await api<StoryShare>("/api/v1/share/story", { json: { attemptId } });
        setStory({ ...s, attemptId });
        setShape("story");
      } catch {
        setBusy(false);
        // A Daily still has its own card to share; anything else says so and stays put.
        if (!daily) return onNotice(storyCopy.failed);
      }
      setBusy(false);
    } else if (!canStory && !daily) return;
    setOpen(true);
  }, [canStory, mine, attemptId, daily, onNotice]);

  const beat =
    challengesOn && cleared && attemptId
      ? async () => {
          try {
            const url = await createChallengeLink(attemptId);
            const text = challengeCopy.share.fromResult(meta.name);
            if (navigator.share) await navigator.share({ text, url });
            else {
              await navigator.clipboard.writeText(`${text} ${url}`);
              onNotice(challengeCopy.share.copied);
            }
          } catch {
            /* share sheet dismissed */
          }
        }
      : undefined;

  const asStory = !!mine && (shape === "story" || !daily);
  const options =
    mine && daily && attemptId ? (
      <div role="radiogroup" aria-label={storyCopy.formatLabel} className="grid grid-cols-2 gap-2">
        {(["story", "square"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={shape === f}
            onClick={() => setShape(f)}
            className={`press min-h-11 rounded-[14px] text-[14px] font-semibold ${shape === f ? "bg-accent text-on-accent" : "bg-bg shadow-[inset_0_0_0_1px_var(--line)]"}`}
          >
            {f === "story" ? storyCopy.story : storyCopy.square}
          </button>
        ))}
      </div>
    ) : undefined;

  const sheet: ReactNode =
    attemptId && (mine || daily) ? (
      <ShareSheet
        open={isOpen}
        onOpenChange={setOpen}
        kind={asStory ? "story" : "daily"}
        title={asStory ? storyCopy.sheetTitle(meta.name) : `${meta.name} on SPUZL`}
        text={asStory ? mine!.text : dailyText}
        image={asStory ? mine!.image : cardUrl("daily", attemptId, shape === "square" && mine ? { format: "square" } : {})}
        fileName={`spuzl-${meta.id}${asStory ? "-story" : ""}.png`}
        preview={
          asStory
            ? { width: 108, height: 192, alt: mine!.alt }
            : shape === "square" && mine
              ? { width: 150, height: 150 }
              : { width: 108, height: 192 }
        }
        options={options}
      />
    ) : null;

  return { open, beat, sheet, busy, canShare: canStory || daily };
}
