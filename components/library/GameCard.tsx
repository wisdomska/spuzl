"use client";

import { primeAttempt } from "@/lib/client/early-attempt";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { WORLD_BY_ID, type GameMeta } from "@/lib/catalog";
import { isRaceGame } from "@/lib/multiplayer/games";
import { durationLabel } from "@/lib/games-meta";
import { formatClock } from "@/lib/format";
import { libraryCopy as T } from "@/lib/copy/library";

/**
 * One game's card (SPZ-14): the rule, then one primary action (today's Daily, or Free play once the Daily
 * is done), Free play second, and the ways to play with others where the game supports them.
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
  const done = doneMs !== undefined;
  useEffect(() => {
    if (!meta) return;
    router.prefetch(done ? `/play/${meta.id}?mode=free` : `/play/${meta.id}`);
  }, [meta, done, router]);
  const go = (href: string) => {
    primeAttempt(href);
    onClose();
    router.push(href as never);
  };
  const world = meta ? WORLD_BY_ID[meta.world] : null;
  const race = meta ? isRaceGame(meta.id) : false;
  return (
    <Dialog.Root open={!!meta} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-[28px] px-5 pt-3 pb-7"
          style={world ? ({ "--world": world.color } as React.CSSProperties) : undefined}
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
                {meta.rule}
              </Dialog.Description>

              <div className="flex flex-col gap-2.5">
                {done ? (
                  <p className="text-accent flex items-center gap-2 px-1 text-[15px] font-semibold">
                    <Icon name="check-circle" size={20} />
                    {T.dailyDone(formatClock(doneMs!))}
                  </p>
                ) : (
                  <Button size="lg" icon="calendar-blank" onClick={() => go(`/play/${meta.id}`)} autoFocus>
                    {T.daily}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={done ? "primary" : "secondary"}
                  icon="infinity"
                  onClick={() => go(`/play/${meta.id}?mode=free`)}
                  autoFocus={done}
                >
                  {T.freePlay}
                </Button>
                {meta.botPlay && (
                  <Button variant="secondary" icon="robot" onClick={() => go(`/play/${meta.id}/bot`)}>
                    {T.vsBot}
                  </Button>
                )}
              </div>

              {race && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted px-1 text-[13px] font-bold">{T.challenge}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: "sword", label: T.quickMatch, href: `/duel?game=${meta.id}` },
                      { icon: "user-plus", label: T.duelFriend, href: `/duel?game=${meta.id}&invite=1` },
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
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
