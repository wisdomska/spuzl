"use client";

import { Button } from "@/components/ui/Button";
import { leaveCopy } from "@/lib/copy/leave";
import type { LeaveKind } from "@/lib/game/leave";
import { Modal, ModalActions } from "@/components/ui/Modal";

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
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onKeep()}
      role="alertdialog"
      zIndex={70}
      gap="gap-3"
      dataAttrs={{ "data-leave-confirm": "" }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={T.title}
      description={T.body}
      footer={
        <ModalActions>
          <Button size="lg" variant="secondary" onClick={onLeave} loading={busy} data-press="soft">
            {T.leave}
          </Button>
          <Button size="lg" icon="play" onClick={onKeep} autoFocus>
            {T.keep}
          </Button>
        </ModalActions>
      }
    />
  );
}
