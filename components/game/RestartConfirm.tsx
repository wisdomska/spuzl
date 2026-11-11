"use client";

import { Button } from "@/components/ui/Button";
import { gameMenuCopy } from "@/lib/copy/game-menu";
import { Modal, ModalActions } from "@/components/ui/Modal";

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
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onKeep()}
      role="alertdialog"
      zIndex={70}
      gap="gap-3"
      dataAttrs={{ "data-restart-confirm": "" }}
      onCloseAutoFocus={onCloseAutoFocus}
      title={T.title}
      description={T.body}
      footer={
        <ModalActions>
          <Button size="lg" variant="secondary" icon="arrow-clockwise" onClick={onRestart} data-press="soft">
            {T.restart}
          </Button>
          <Button size="lg" icon="play" onClick={onKeep} autoFocus>
            {T.keep}
          </Button>
        </ModalActions>
      }
    />
  );
}
