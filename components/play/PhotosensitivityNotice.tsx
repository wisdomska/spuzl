"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

const KEY = "spuzl.photosensitivity.ok";

/** Shown once before the first action or flashing game (system layer, z 80). Flashing is capped at 2 Hz. */
export function PhotosensitivityNotice() {
  const needed = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(KEY) !== "1";
      } catch {
        return true;
      }
    },
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const open = needed && !dismissed;
  const ok = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setDismissed(true);
  };
  // The shared sheet (focus trap, no page scroll behind); it needs an answer, so no close button or Escape.
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && ok()}
      role="alertdialog"
      zIndex={80}
      gap="gap-3"
      close={false}
      dismissible={false}
      leading={<Icon name="warning" size={28} className="text-gold mt-0.5 shrink-0" />}
      title="Heads up"
      description="This game has quick movement and light flashes, kept slower than twice a second. If flashing lights affect you, pick a calmer game or turn on reduced motion in Settings."
    >
      <Button size="lg" autoFocus onClick={ok}>
        Got it
      </Button>
    </Modal>
  );
}
