"use client";

import Link from "next/link";
import type { GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { isLadderGame, ladderDone } from "@/lib/game/levels";
import type { LadderSummary } from "@/lib/client/levels";
import { levelHref } from "@/lib/client/levels";
import { levelsCopy } from "@/lib/copy/levels";

/**
 * Secondary entry under a game card for games with a level ladder: the player's current level ("Level 12 ·
 * Next: 13"), tapping plays the next level. A sibling of the card link (never nested in it), 44 px tall.
 */
export function LevelEntry({ meta, progress }: { meta: GameMeta; progress?: LadderSummary }) {
  if (!isLadderGame(meta.id)) return null;
  const top = progress?.top ?? 0;
  const next = progress?.next ?? 1;
  return (
    <Link
      href={levelHref(meta.id)}
      aria-label={`${levelsCopy.mode}: ${levelsCopy.status(top, next, ladderDone(meta.id, top))}`}
      className="press bg-surface-raised flex h-11 items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-semibold"
    >
      <Icon name="mountains" size={18} style={{ color: "var(--world)" }} />
      <span className="num">{levelsCopy.status(top, next, ladderDone(meta.id, top))}</span>
    </Link>
  );
}
