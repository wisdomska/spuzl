"use client";

import Link from "next/link";
import { useState } from "react";
import type { GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/meta/Sheet";
import { useMe } from "@/lib/client/api";
import { useSettings } from "@/lib/settings/store";
import { challengeLinks, isRaceGame } from "@/lib/multiplayer/games";
import { partyCopy } from "@/lib/copy/party";

/*
 * Game-first Duel and Party (SPZ-13): from a game, pick how to race it. Each option opens the existing
 * mode-first flow with the game preselected (see `challengeLinks`).
 */

/** Race games only, and never in Relaxed mode (no clocks, so Duels and Party Races are off). */
export function useCanChallenge(meta: GameMeta) {
  const relaxed = useSettings((s) => s.relaxed);
  return isRaceGame(meta.id) && !relaxed;
}

export function GameChallengeSheet({
  meta,
  open,
  onClose,
  onBeatMyTime,
}: {
  meta: GameMeta;
  open: boolean;
  onClose: () => void;
  /** Results: "Beat my time" sends this exact puzzle as an async challenge. */
  onBeatMyTime?: () => void;
}) {
  const me = useMe();
  const youngster = me.data?.age_band === "13-15";
  const live = useCanChallenge(meta);
  const links = challengeLinks(meta.id);
  const c = partyCopy.challenge;
  const liveRows = [
    { key: "friend", href: links.friend, icon: "user-plus", title: c.friend, hint: c.friendHint, locked: false },
    {
      key: "quick",
      href: links.quick,
      icon: "lightning",
      title: c.quick,
      hint: youngster ? c.quickLocked : c.quickHint,
      locked: youngster,
    },
    { key: "party", href: links.party, icon: "confetti", title: c.party, hint: c.partyHint, locked: false },
  ];
  const rows = live ? liveRows : [];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={c.title(meta.name)} description={c.body}>
      <ul className="flex flex-col gap-2.5 pt-1">
        {onBeatMyTime && (
          <li>
            <button
              type="button"
              onClick={() => {
                onClose();
                onBeatMyTime();
              }}
              className="press bg-surface-raised flex min-h-16 w-full items-center gap-3 rounded-[20px] p-3 text-left"
            >
              <span className="bg-surface flex size-11 flex-none items-center justify-center rounded-[14px]">
                <Icon name="timer" size={22} className="text-accent" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-[17px] font-black">{c.beat}</span>
                <span className="text-muted text-[14px] font-medium">{c.beatHint}</span>
              </span>
              <Icon name="caret-right" size={18} className="text-muted" />
            </button>
          </li>
        )}
        {rows.map((r) => {
          const inner = (
            <>
              <span className="bg-surface flex size-11 flex-none items-center justify-center rounded-[14px]">
                <Icon name={r.icon} size={22} className={r.locked ? "text-muted" : "text-accent"} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-display text-[17px] font-black">{r.title}</span>
                <span className="text-muted text-[14px] font-medium">{r.hint}</span>
              </span>
              {!r.locked && <Icon name="caret-right" size={18} className="text-muted" />}
            </>
          );
          const cls = "flex min-h-16 items-center gap-3 rounded-[20px] bg-surface-raised p-3 text-left";
          return (
            <li key={r.key}>
              {r.locked ? (
                <div className={`${cls} opacity-70`} aria-disabled>
                  {inner}
                </div>
              ) : (
                <Link href={r.href} onClick={onClose} className={`press ${cls}`}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" className="mt-1 w-full" onClick={onClose}>
        {c.close}
      </Button>
    </Sheet>
  );
}

/** World view: a 44 px row under a race game's card, a sibling of the card link (never nested). */
export function ChallengeEntry({ meta }: { meta: GameMeta }) {
  const [open, setOpen] = useState(false);
  if (!useCanChallenge(meta)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={partyCopy.challenge.ctaAria(meta.name)}
        className="press bg-surface flex min-h-11 items-center gap-2.5 rounded-[16px] px-3.5 text-left text-[14px] font-semibold"
      >
        <Icon name="sword" size={20} style={{ color: "var(--world)" }} />
        <span className="flex-1">{partyCopy.challenge.cta}</span>
        <Icon name="caret-right" size={16} className="text-muted" />
      </button>
      <GameChallengeSheet meta={meta} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Play screen (results and the free-play end bar): one "Challenge" button for every way to play with others:
 * beat my time (when offered) plus live Duel and Party for race games.
 */
export function RaceLiveButton({
  meta,
  size = "lg",
  className = "",
  onBeatMyTime,
}: {
  meta: GameMeta;
  size?: "md" | "lg";
  className?: string;
  onBeatMyTime?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const live = useCanChallenge(meta);
  if (!live && !onBeatMyTime) return null;
  return (
    <>
      <Button variant="secondary" size={size} icon="sword" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {partyCopy.challenge.cta}
      </Button>
      <GameChallengeSheet meta={meta} open={open} onClose={() => setOpen(false)} onBeatMyTime={onBeatMyTime} />
    </>
  );
}
