"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const KEY = "spuzl.photosensitivity.ok";

/** Shown once before the first action or flashing game (system layer, z 80). Flashing is capped at 2 Hz. */
export function PhotosensitivityNotice() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);
  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ps-title"
      className="fixed inset-0 z-[80] flex items-end bg-[rgb(6_7_13/.8)] sm:items-center"
    >
      <div className="safe-bottom bg-surface mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-[32px] px-5 pt-6 pb-7 sm:rounded-[32px]">
        <Icon name="warning" size={28} className="text-gold" />
        <h2 id="ps-title" className="font-display text-[22px] font-black">
          Heads up
        </h2>
        <p className="text-muted text-[16px] leading-normal">
          This game has quick movement and light flashes, kept slower than twice a second. If flashing lights affect you, pick a calmer game
          or turn on reduced motion in Settings.
        </p>
        <Button
          size="lg"
          autoFocus
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {}
            setOpen(false);
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
