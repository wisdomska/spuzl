"use client";

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { useSheetSound } from "@/lib/audio/useSheetSound";
import { gameMenuCopy } from "@/lib/copy/game-menu";

/**
 * The game menu's Restart (or Reset) asks first once the board has moves on it: starting over cannot be undone.
 * Same light sheet as LeaveConfirm: Keep playing is the default (focused; Escape or a tap outside keeps playing).
 */
export function RestartConfirm({
  open,
  onKeep,
  onRestart,
  onCloseAutoFocus,
}: {
  open: boolean;
  onKeep: () => void;
  onRestart: () => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const T = gameMenuCopy.restartConfirm;
  useSheetSound(open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onKeep()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          role="alertdialog"
          data-restart-confirm
          onCloseAutoFocus={onCloseAutoFocus}
          className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-[560px] flex-col gap-3 rounded-t-[28px] px-5 pt-5 pb-7"
        >
          <Dialog.Title className="font-display text-[22px] font-black">{T.title}</Dialog.Title>
          <Dialog.Description className="text-muted text-[15px]">{T.body}</Dialog.Description>
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <Button size="lg" variant="secondary" icon="arrow-clockwise" onClick={onRestart} data-press="soft">
              {T.restart}
            </Button>
            <Button size="lg" icon="play" onClick={onKeep} autoFocus>
              {T.keep}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
