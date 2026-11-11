"use client";

import { Button } from "@/components/ui/Button";
import { useGameSettings } from "@/lib/game-settings/client";
import { copy } from "@/lib/copy";
import { Modal, ModalActions } from "@/components/ui/Modal";

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
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      role="alertdialog"
      gap="gap-3"
      title={T.hintConfirmTitle}
      description={daily ? T.hintConfirmDaily(kept) : T.hintConfirmFree}
      footer={
        <ModalActions>
          <Button size="lg" variant="secondary" onClick={onCancel}>
            {T.cancel}
          </Button>
          <Button size="lg" icon="lightbulb" onClick={onConfirm} autoFocus>
            {T.useHint}
          </Button>
        </ModalActions>
      }
    />
  );
}
