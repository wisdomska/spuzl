"use client";

import { showTapSkeleton } from "@/components/shell/TapSkeleton";
import { warmPlay } from "@/lib/perf/prefetch";
import { useGameSettings } from "@/lib/game-settings/client";
import { primeAttempt } from "@/lib/client/early-attempt";
import { useEffect, useState } from "react";
import { LevelSheet } from "@/components/levels/LevelSheet";
import { isLadderGame, ladderDone } from "@/lib/game/levels";
import { levelHref, useLevels } from "@/lib/client/levels";
import { levelsCopy as L } from "@/lib/copy/levels";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { WORLD_BY_ID, type GameMeta, UI_ACCENT } from "@/lib/catalog";
import { isPartyGame, isRaceGame } from "@/lib/multiplayer/games";
import { isBayGame } from "@/lib/multiplayer/bay";
import { bayLive } from "@/lib/copy/bay-live";
import { useSettings } from "@/lib/settings/store";
import { LiveLockedNote, inviteHref, liveHref, useLiveLocked } from "@/components/world/LiveEntry";
import { durationLabel, gameCopy } from "@/lib/games-meta";
import { useGamesMeta } from "@/lib/games-meta/client";
import { formatClock } from "@/lib/format";
import { libraryCopy as T } from "@/lib/copy/library";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { useSheetSound } from "@/lib/audio/useSheetSound";

/**
 * One game's card (SPZ-14): the rule, then one primary action (Play; with Dailies on, today's Daily then Free play
 * is done), Free play second, and the ways to play with others where the game supports them.
 * R2-12: for a game with a level ladder the primary is the player's next level by name ("Play Level 3"), the
 * Daily and Free play follow as secondary, and "All levels" (with where the player stands) is a text link.
 */
export function GameCard({
  meta,
  onClose,
  doneMs,
  typicalSec,
}: {
  meta: GameMeta | null;
  onClose: () => void;
  doneMs?: number;
  typicalSec?: number;
}) {
  const router = useRouter();
  const gameSettings = useGameSettings();
  const dailies = gameSettings["features.dailies"];
  const done = dailies && doneMs !== undefined;
  const ladder = meta ? isLadderGame(meta.id) : false;
  const levels = useLevels(ladder);
  const progress = meta ? levels.data?.games[meta.id] : undefined;
  const finished = !!meta && !!progress && ladderDone(meta.id, progress.top);
  const levelStatus = progress ? L.status(progress.top, progress.next, finished) : null;
  // R2-12: a ladder game's primary is the player's next level, named ("Play Level 3"), until the ladder is done.
  const levelFirst = ladder && !finished;
  const nextLevel = progress?.next;
  const primaryHref = !meta
    ? null
    : levelFirst
      ? levelHref(meta.id, nextLevel)
      : dailies && !done
        ? `/play/${meta.id}`
        : `/play/${meta.id}?mode=free`;
  // Wait for the level number before warming a ladder game, so the one full prefetch is the link the button opens.
  const warmHref = levelFirst && levels.isPending ? null : primaryHref;
  useEffect(() => {
    if (!warmHref) return;
    // R2-01: the card is open, so this game is the likely tap: its page, code and board in full.
    warmPlay(router, warmHref);
  }, [warmHref, router]);
  const go = (href: string) => {
    primeAttempt(href);
    showTapSkeleton(href);
    onClose();
    router.push(href as never);
  };
  const world = meta ? WORLD_BY_ID[meta.world] : null;
  const metaRows = useGamesMeta();
  const race = meta ? isRaceGame(meta.id) : false;
  // R4-08: score games (Quickfire, Echo, Beat Tap, ...) race in Party only, while score races are on.
  const scoreParty = !!meta && !race && isPartyGame(meta.id, gameSettings);
  // Board Bay games: play someone live (matchmaking) or invite a friend.
  const bay = meta ? isBayGame(meta.id) : false;
  const relaxed = useSettings((s) => s.relaxed);
  const liveLocked = useLiveLocked();
  const [levelsOpen, setLevelsOpen] = useState(false);
  useSheetSound(!!meta);
  return (
    <Dialog.Root open={!!meta} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-[28px] px-5 pt-3 pb-7"
          style={world ? ({ "--world": UI_ACCENT } as React.CSSProperties) : undefined}
        >
          <div aria-hidden className="bg-line mx-auto h-1.5 w-10 shrink-0 rounded-full" />
          {meta && world && (
            <>
              <div className="flex items-center gap-3.5">
                <GameIcon3D meta={meta} size={64} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Dialog.Title className="font-display text-[24px] leading-tight font-black">{meta.name}</Dialog.Title>
                  <span className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: world.color }} />
                      {world.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="timer" size={14} />
                      {durationLabel(typicalSec ?? 180)}
                    </span>
                  </span>
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center self-start rounded-[14px]"
                >
                  <Icon name="x" size={18} />
                </Dialog.Close>
              </div>
              <Dialog.Description className="bg-surface-raised rounded-[16px] px-4 py-3 text-[15px] leading-[1.45] font-medium">
                <span className="text-muted block text-[12px] font-bold tracking-[0.04em] uppercase">{T.rule}</span>
                {gameCopy(meta, metaRows).rule}
              </Dialog.Description>

              <div className="flex flex-col gap-2.5">
                {levelFirst && (
                  <Button size="lg" icon="mountains" onClick={() => go(levelHref(meta.id, nextLevel))} autoFocus {...PLAY_NAV}>
                    {nextLevel ? L.play(nextLevel) : T.play}
                  </Button>
                )}
                {!dailies ? (
                  <Button
                    size="lg"
                    variant={levelFirst ? "secondary" : "primary"}
                    icon={levelFirst ? "infinity" : "play"}
                    onClick={() => go(`/play/${meta.id}?mode=free`)}
                    autoFocus={!levelFirst}
                    {...PLAY_NAV}
                  >
                    {levelFirst ? T.freePlay : T.play}
                  </Button>
                ) : done ? (
                  <p className="text-accent flex items-center gap-2 px-1 text-[15px] font-semibold">
                    <Icon name="check-circle" size={20} />
                    {T.dailyDone(formatClock(doneMs!))}
                  </p>
                ) : (
                  <Button
                    size="lg"
                    variant={levelFirst ? "secondary" : "primary"}
                    icon="calendar-blank"
                    onClick={() => go(`/play/${meta.id}`)}
                    autoFocus={!levelFirst}
                    {...PLAY_NAV}
                  >
                    {T.daily}
                  </Button>
                )}
                {dailies && (
                  <Button
                    size="lg"
                    variant={done && !levelFirst ? "primary" : "secondary"}
                    icon="infinity"
                    onClick={() => go(`/play/${meta.id}?mode=free`)}
                    autoFocus={done && !levelFirst}
                    {...PLAY_NAV}
                  >
                    {T.freePlay}
                  </Button>
                )}
                {ladder && (
                  // "All levels" is a secondary text link to the level list.
                  <button
                    type="button"
                    onClick={() => setLevelsOpen(true)}
                    aria-haspopup="dialog"
                    className="press text-muted flex min-h-11 items-center justify-center gap-1.5 rounded-[12px] px-2 text-[14px] font-semibold underline-offset-4 hover:underline"
                  >
                    <Icon name="flag-checkered" size={16} />
                    {/* The primary already names the next level; the link only adds a finished ladder's tally. */}
                    {finished && levelStatus ? `${levelStatus} · ${L.allLevels}` : L.allLevels}
                  </button>
                )}
                {meta.botPlay && (
                  <Button variant="secondary" icon="robot" onClick={() => go(`/play/${meta.id}/bot`)}>
                    {T.vsBot}
                  </Button>
                )}
              </div>

              {bay && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted px-1 text-[13px] font-bold">{bayLive.liveGroup}</span>
                  {/* R4-01: under 16, Play live is a muted note (the server refuses it), never a button. */}
                  {!relaxed && liveLocked && <LiveLockedNote />}
                  <div className={`grid gap-2 ${!relaxed && liveLocked ? "grid-cols-1" : "grid-cols-2"}`}>
                    {[
                      ...(relaxed || liveLocked
                        ? []
                        : [{ icon: "lightning", label: bayLive.playLive, aria: bayLive.playLiveAria(meta.name), href: liveHref(meta.id) }]),
                      {
                        icon: "user-plus",
                        label: bayLive.challengeFriend,
                        aria: bayLive.challengeFriendAria(meta.name),
                        href: inviteHref(meta.id),
                      },
                    ].map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        aria-label={a.aria}
                        onClick={() => go(a.href)}
                        className="press bg-surface-raised flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[16px] px-1.5 text-center text-[13px] leading-tight font-semibold"
                      >
                        <Icon name={a.icon} size={22} style={{ color: "var(--world)" }} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(race || scoreParty) && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted px-1 text-[13px] font-bold">{T.challenge}</span>
                  <div className={`grid gap-2 ${race ? "grid-cols-3" : "grid-cols-1"}`}>
                    {[
                      ...(race
                        ? [
                            { icon: "sword", label: T.quickMatch, href: `/duel?game=${meta.id}` },
                            { icon: "user-plus", label: T.duelFriend, href: `/duel?game=${meta.id}&invite=1` },
                          ]
                        : []),
                      { icon: "users-three", label: T.hostParty, href: `/party?host=1&game=${meta.id}` },
                    ].map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => go(a.href)}
                        className="press bg-surface-raised flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[16px] px-1.5 text-center text-[13px] leading-tight font-semibold"
                      >
                        <Icon name={a.icon} size={22} style={{ color: "var(--world)" }} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {ladder && (
                <LevelSheet
                  meta={meta}
                  open={levelsOpen}
                  onClose={() => setLevelsOpen(false)}
                  onPlay={(n) => {
                    setLevelsOpen(false);
                    go(levelHref(meta.id, n));
                  }}
                />
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
