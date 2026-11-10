"use client";

import Link from "next/link";
import type { GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { bayLive } from "@/lib/copy/bay-live";
import { isBayGame } from "@/lib/multiplayer/bay";
import { canPlayLive } from "@/lib/multiplayer/liveGate";
import { useMe } from "@/lib/client/api";
import { useSettings } from "@/lib/settings/store";

/** Board Bay links for a board game: "Play live" opens matchmaking, "Challenge a friend" the invite sheet. */
export const liveHref = (game: string) => `/bay?live=${game}`;
export const inviteHref = (game: string) => `/bay?new=${game}`;

/**
 * R4-01: true when the signed-in player is under 16, so Board Bay "Play live" shows as a muted "Opens at 16" note
 * (the server refuses it with 403 age_restricted whatever the screen). While the profile loads, or with no profile
 * yet, the entry stays as it was: the Bay screen sends a first-run visitor through onboarding.
 */
export function useLiveLocked() {
  const me = useMe();
  return !!me.data && !canPlayLive(me.data);
}

/** R4-01: the muted note in place of "Play live" for under-16s. Not a button, and not styled like one. */
export function LiveLockedNote() {
  return (
    <p data-testid="live-locked" className="text-muted flex min-h-11 items-center gap-2 px-1">
      <Icon name="lock-simple" size={18} className="shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[14px] font-semibold">{bayLive.playLive}</span>
        <span className="text-[13px] font-medium">{bayLive.liveLocked}</span>
      </span>
    </p>
  );
}

/**
 * Entries under a board game's card for games Board Bay plays (World view): find someone to play live, or
 * invite a friend. Siblings of the card link (never nested in it), 44 px tall. Relaxed mode hides timers, so
 * it hides Play live (timed); a friend game can still be 24 h per move. Under 16, Play live is a muted note.
 */
export function LiveEntries({ meta }: { meta: GameMeta }) {
  const relaxed = useSettings((s) => s.relaxed);
  const locked = useLiveLocked();
  if (!isBayGame(meta.id)) return null;
  const cls = "press bg-surface-raised flex h-11 items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-semibold";
  return (
    <>
      {!relaxed && locked && <LiveLockedNote />}
      {!relaxed && !locked && (
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
