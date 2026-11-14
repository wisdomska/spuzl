"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { GameMeta } from "@/lib/catalog";
import { api } from "@/lib/client/api";
import { createChallengeLink } from "@/lib/client/challenge";
import { useGameSettings } from "@/lib/game-settings/client";
import { challengeCopy } from "@/lib/copy/challenge";
import { freeCardCopy, storyCopy } from "@/lib/copy/share";
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
 * Daily and archive clears keep their older Daily card, and free-play clears have their own card (R4-20,
 * `/api/og/free/<attempt>`), as a Square choice beside the story (and as the whole sheet while story cards are off
 * or the story can't be made). "Beat my time" (admin "features.challenges") sends the challenge link straight away.
 *
 *   const share = useClearShare({ meta, attemptId, cleared, daily, free, text, onNotice });
 *   share.open()  share.beat  share.sheet  share.busy
 */
export function useClearShare({
  meta,
  attemptId,
  cleared,
  daily,
  free = false,
  text,
  onNotice,
}: {
  meta: GameMeta;
  attemptId: string | null;
  /** a verified clear (the server refuses anything else) */
  cleared: boolean;
  /** a Daily or archive clear: the older Daily card exists for it */
  daily: boolean;
  /** a free-play clear: the free-play card exists for it (R4-20) */
  free?: boolean;
  /** share text for the Daily or free-play card */
  text: string;
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
  // The clear's own card: the Daily card, or the free-play card for a verified free clear.
  const card = daily ? ("daily" as const) : free && cleared ? ("free" as const) : null;

  const open = useCallback(async () => {
    if (canStory && !mine && attemptId) {
      setBusy(true);
      try {
        const s = await api<StoryShare>("/api/v1/share/story", { json: { attemptId } });
        setStory({ ...s, attemptId });
        setShape("story");
      } catch {
        setBusy(false);
        // A clear with its own card shares that; anything else says so and stays put.
        if (!card) return onNotice(storyCopy.failed);
      }
      setBusy(false);
    } else if (!canStory && !card) return;
    setOpen(true);
  }, [canStory, mine, attemptId, card, onNotice]);

  // "Beat my time" races the clock; an action run scored on distance (Dash) has the Ghost Race for that instead.
  const timeRace = !(meta.engine === "phaser" && meta.scoring === "score");
  const beat =
    challengesOn && cleared && attemptId && timeRace
      ? async () => {
          try {
            const url = await createChallengeLink(attemptId);
            const line = challengeCopy.share.fromResult(meta.name);
            if (navigator.share) await navigator.share({ text: line, url });
            else {
              await navigator.clipboard.writeText(`${line} ${url}`);
              onNotice(challengeCopy.share.copied);
            }
          } catch {
            /* share sheet dismissed */
          }
        }
      : undefined;

  const asStory = !!mine && (shape === "story" || !card);
  const options =
    mine && card && attemptId ? (
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
    attemptId && (mine || card) ? (
      <ShareSheet
        open={isOpen}
        onOpenChange={setOpen}
        kind={asStory ? "story" : (card ?? "daily")}
        title={asStory ? storyCopy.sheetTitle(meta.name) : freeCardCopy.sheetTitle(meta.name)}
        text={asStory ? mine!.text : text}
        image={asStory ? mine!.image : cardUrl(card ?? "daily", attemptId, shape === "square" && mine ? { format: "square" } : {})}
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

  return { open, beat, sheet, busy, canShare: canStory || !!card };
}
