"use client";

import { useGameSettings } from "@/lib/game-settings/client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WORLD_BY_ID, colourOf, type GameMeta } from "@/lib/catalog";
import { useGameCopy } from "@/lib/games-meta/client";
import { Modal } from "@/components/ui/Modal";

export interface HowToTip {
  icon: string;
  text: string;
}

/**
 * Help button: the game's rule and how to play (FR-GP-06), replayable any time. A mode with its own
 * rules (vs bot) passes `tips` in place of the solo puzzle tips.
 */
export function HowToSheet({ open, meta, onClose, tips }: { open: boolean; meta: GameMeta; onClose: () => void; tips?: HowToTip[] }) {
  const dailies = useGameSettings()["features.dailies"];
  const world = WORLD_BY_ID[meta.world];
  const { rule } = useGameCopy(meta);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      describedBy="howto-rule"
      title={meta.name}
      description={world.name}
      leading={
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-[14px] text-[var(--ink-on-bright)]"
          style={{ background: colourOf(meta).color }}
        >
          <Icon name={meta.icon} size={26} />
        </span>
      }
    >
      <p id="howto-rule" className="text-[17px] leading-normal font-medium">
        {rule}
      </p>
      {tips ? (
        <ul className="text-muted flex flex-col gap-2 text-[15px]">
          {tips.map((tip) => (
            <li key={tip.text} className="flex gap-2">
              <Icon name={tip.icon} size={18} /> {tip.text}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="text-muted flex flex-col gap-2 text-[15px]">
          {dailies && (
            <li className="flex gap-2">
              <Icon name="calendar-blank" size={18} /> One shared Daily for everyone, resets at midnight GMT.
            </li>
          )}
          <li className="flex gap-2">
            <Icon name="infinity" size={18} /> {dailies ? "Free play never runs out." : "New puzzles never run out."}
          </li>
          <li className="flex gap-2">
            <Icon name="lightbulb" size={18} /> {dailies ? "Up to 3 hints. Hints halve the Daily XP." : "Up to 3 hints per puzzle."}
          </li>
          <li className="flex gap-2">
            <Icon name="keyboard" size={18} /> Arrow keys move, Space marks, Enter confirms.
          </li>
        </ul>
      )}
      <Button size="lg" onClick={onClose} autoFocus>
        Play
      </Button>
    </Modal>
  );
}
