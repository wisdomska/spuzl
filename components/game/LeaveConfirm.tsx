"use client";

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { useSheetSound } from "@/lib/audio/useSheetSound";
import { leaveCopy } from "@/lib/copy/leave";
import type { LeaveKind } from "@/lib/game/leave";

/**
 * The one light confirm before leaving a game where leaving costs something (lib/game/leave.ts). Keep playing
 * is the default button (focused, and Escape or a tap outside keeps playing); Radix gives the dialog its
 * focus trap and labelling and returns focus to whatever opened it.
 */
export function LeaveConfirm({
  kind,
  open,
  busy,
  onKeep,
  onLeave,
  onCloseAutoFocus,
}: {
  kind: Exclude<LeaveKind, "none">;
  open: boolean;
  busy?: boolean;
  onKeep: () => void;
  onLeave: () => void;
  /** where focus goes when the dialog closes (default: Radix returns it to what had it before) */
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const T = leaveCopy[kind];
  useSheetSound(open);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onKeep()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[70] bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          role="alertdialog"
          data-leave-confirm
          onCloseAutoFocus={onCloseAutoFocus}
          className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-w-[560px] flex-col gap-3 rounded-t-[28px] px-5 pt-5 pb-7"
        >
          <Dialog.Title className="font-display text-[22px] font-black">{T.title}</Dialog.Title>
          <Dialog.Description className="text-muted text-[15px]">{T.body}</Dialog.Description>
          <div className="mt-1 grid grid-cols-2 gap-2.5">
            <Button size="lg" variant="secondary" onClick={onLeave} loading={busy} data-press="soft">
              {T.leave}
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
