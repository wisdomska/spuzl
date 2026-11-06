"use client";

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { type GameMeta, UI_ACCENT } from "@/lib/catalog";
import { formatClock } from "@/lib/format";
import { isBossLevel, levelCount, levelDifficulty, nextLevel, SEEDED_LADDERS } from "@/lib/game/levels";
import { useGameLevels } from "@/lib/client/levels";
import { levelsCopy as T } from "@/lib/copy/levels";
import { useSheetSound } from "@/lib/audio/useSheetSound";

/** Tiles shown past the next level on an endless ladder (a peek at what is coming, all locked). */
const AHEAD = 4;

/**
 * A game's level map: every level as a numbered tile (cleared with its best time, the next one highlighted,
 * the rest locked), plus one primary action for the next level. Picking a tile calls `onPlay(n)`.
 */
export function LevelSheet({
  meta,
  open,
  onClose,
  onPlay,
}: {
  meta: GameMeta;
  open: boolean;
  onClose: () => void;
  onPlay: (n: number) => void;
}) {
  const q = useGameLevels(meta.id, open);
  useSheetSound(open);
  const top = q.data?.top ?? 0;
  const count = levelCount(meta.id);
  const next = nextLevel(meta.id, top);
  const done = count !== null && top >= count;
  const seeded = (SEEDED_LADDERS as readonly string[]).includes(meta.id);
  const shown = count ?? Math.max(10, Math.ceil((top + 1 + AHEAD) / 5) * 5);
  const best = new Map((q.data?.cleared ?? []).map((c) => [c.level, c.bestMs]));
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          className="sheet-content safe-bottom bg-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-[28px] px-5 pt-3 pb-7"
          style={{ "--world": UI_ACCENT } as React.CSSProperties}
        >
          <div aria-hidden className="bg-line mx-auto h-1.5 w-10 shrink-0 rounded-full" />
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Dialog.Title className="font-display text-[24px] leading-tight font-black">{T.sheetTitle(meta.name)}</Dialog.Title>
              <Dialog.Description className="text-muted text-[14px] leading-[1.4]">{T.sheetLead}</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]"
            >
              <Icon name="x" size={18} />
            </Dialog.Close>
          </div>

          {q.isError ? (
            <p className="text-muted text-[15px]">{T.loadFailed}</p>
          ) : (
            <>
              <p className="text-[15px] font-semibold" aria-live="polite">
                {q.isPending ? T.loading : T.status(top, next, done)}
                {!q.isPending && seeded && !done && (
                  <span className="text-muted">
                    {" "}
                    · {T.difficulty[levelDifficulty(next)]}
                    {isBossLevel(next) && ` · ${T.boss}`}
                  </span>
                )}
              </p>
              <Button size="lg" icon="play" onClick={() => onPlay(next)} disabled={q.isPending} autoFocus>
                {T.play(next)}
              </Button>
              <ol className="grid grid-cols-5 gap-2" aria-label={T.allLevels}>
                {Array.from({ length: shown }, (_, i) => i + 1).map((n) => {
                  const state = n <= top ? "cleared" : n === next && !done ? "next" : "locked";
                  const ms = best.get(n);
                  const time = ms !== undefined ? formatClock(ms) : undefined;
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        disabled={state === "locked" || q.isPending}
                        onClick={() => onPlay(n)}
                        aria-label={T.tileLabel(n, state, time)}
                        className={`press flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-[14px] text-[16px] font-extrabold disabled:cursor-not-allowed ${
                          state === "next"
                            ? "bg-accent text-on-accent"
                            : state === "cleared"
                              ? "bg-surface-raised text-text"
                              : "bg-surface-raised text-muted opacity-60"
                        }`}
                      >
                        <span className="num leading-none">{n}</span>
                        <Icon name={state === "cleared" ? "check" : state === "next" ? "play" : "lock-simple"} size={12} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              {count === null && <p className="text-muted text-center text-[13px]">{T.endless}</p>}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
