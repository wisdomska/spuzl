"use client";

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WORLD_BY_ID, type GameMeta } from "@/lib/catalog";

/** Help button: the game's rule and how to play (FR-GP-06), replayable any time. */
export function HowToSheet({ open, meta, onClose }: { open: boolean; meta: GameMeta; onClose: () => void }) {
  const world = WORLD_BY_ID[meta.world];
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          className="safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[560px] flex-col gap-4 rounded-t-[32px] px-5 pt-3.5 pb-7"
          aria-describedby="howto-rule"
        >
          <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-[14px] text-[#0E0F1A]" style={{ background: world.color }}>
              <Icon name={meta.icon} size={26} />
            </span>
            <div>
              <Dialog.Title className="font-display text-[22px] font-black">{meta.name}</Dialog.Title>
              <p className="text-muted text-[14px]">{world.name}</p>
            </div>
          </div>
          <p id="howto-rule" className="text-[17px] leading-normal font-medium">
            {meta.rule}
          </p>
          <ul className="text-muted flex flex-col gap-2 text-[15px]">
            <li className="flex gap-2">
              <Icon name="calendar-blank" size={18} /> One shared Daily for everyone, resets at midnight GMT.
            </li>
            <li className="flex gap-2">
              <Icon name="infinity" size={18} /> Free play never runs out.
            </li>
            <li className="flex gap-2">
              <Icon name="lightbulb" size={18} /> Up to 3 hints. Hints halve the Daily XP.
            </li>
            <li className="flex gap-2">
              <Icon name="keyboard" size={18} /> Arrow keys move, Space marks, Enter confirms.
            </li>
          </ul>
          <Button size="lg" onClick={onClose} autoFocus>
            Play
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
