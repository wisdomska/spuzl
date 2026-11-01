"use client";

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { useGameSettings } from "@/lib/game-settings/client";
import { copy } from "@/lib/copy";
import { useSheetSound } from "@/lib/audio/useSheetSound";

const KEY = "spuzl.hintOk";

/** Has the player already confirmed hints in this game on this device? */
export function hintConfirmed(gameId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).includes(gameId);
  } catch {
    return false;
  }
}

export function rememberHintConfirmed(gameId: string) {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
    seen.add(gameId);
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    /* storage blocked: the confirm simply shows again next time */
  }
}

/** First hint per game: "Use a hint? Daily XP is halved." with Cancel / Use hint. */
export function HintConfirm({
  open,
  daily,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  daily: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const kept = useGameSettings()["hints.dailyXpKeptPct"];
  const T = copy.shell;
  useSheetSound(open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[560px] flex-col gap-3 rounded-t-[28px] px-5 pt-5 pb-7">
          <Dialog.Title className="font-display text-[22px] font-black">{T.hintConfirmTitle}</Dialog.Title>
          <Dialog.Description className="text-muted text-[15px]">{daily ? T.hintConfirmDaily(kept) : T.hintConfirmFree}</Dialog.Description>
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <Button size="lg" variant="secondary" onClick={onCancel}>
              {T.cancel}
            </Button>
            <Button size="lg" icon="lightbulb" onClick={onConfirm} autoFocus>
              {T.useHint}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
