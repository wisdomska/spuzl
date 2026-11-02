"use client";

import Link from "next/link";
import type { GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { bayLive } from "@/lib/copy/bay-live";
import { isBayGame } from "@/lib/multiplayer/bay";
import { useSettings } from "@/lib/settings/store";

/** Board Bay links for a board game: "Play live" opens matchmaking, "Challenge a friend" the invite sheet. */
export const liveHref = (game: string) => `/bay?live=${game}`;
export const inviteHref = (game: string) => `/bay?new=${game}`;

/**
 * Entries under a board game's card for games Board Bay plays (World view): find someone to play live, or
 * invite a friend. Siblings of the card link (never nested in it), 44 px tall. Relaxed mode hides timers, so
 * it hides Play live (5 minute clocks); a friend game can still be 24 h per move.
 */
export function LiveEntries({ meta }: { meta: GameMeta }) {
  const relaxed = useSettings((s) => s.relaxed);
  if (!isBayGame(meta.id)) return null;
  const cls = "press bg-surface-raised flex h-11 items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-semibold";
  return (
    <>
      {!relaxed && (
        <Link href={liveHref(meta.id)} aria-label={bayLive.playLiveAria(meta.name)} className={cls}>
          <Icon name="lightning" size={18} style={{ color: "var(--world)" }} />
          {bayLive.playLive}
        </Link>
      )}
      <Link href={inviteHref(meta.id)} aria-label={bayLive.challengeFriendAria(meta.name)} className={cls}>
        <Icon name="user-plus" size={18} style={{ color: "var(--world)" }} />
        {bayLive.challengeFriend}
      </Link>
    </>
  );
}

/** True when a board game card should show its "with others" footer for Board Bay. */
export const hasLiveEntries = (id: string) => isBayGame(id);
