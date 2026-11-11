"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { type GameMeta, UI_ACCENT } from "@/lib/catalog";
import { formatClock } from "@/lib/format";
import { isBossLevel, levelCount, levelDifficulty, nextLevel, SEEDED_LADDERS } from "@/lib/game/levels";
import { useGameLevels } from "@/lib/client/levels";
import { levelsCopy as T } from "@/lib/copy/levels";
import { Modal } from "@/components/ui/Modal";

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
  const top = q.data?.top ?? 0;
  const count = levelCount(meta.id);
  const next = nextLevel(meta.id, top);
  const done = count !== null && top >= count;
  const seeded = (SEEDED_LADDERS as readonly string[]).includes(meta.id);
  const shown = count ?? Math.max(10, Math.ceil((top + 1 + AHEAD) / 5) * 5);
  const best = new Map((q.data?.cleared ?? []).map((c) => [c.level, c.bestMs]));
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={T.sheetTitle(meta.name)}
      description={T.sheetLead}
      style={{ "--world": UI_ACCENT } as React.CSSProperties}
    >
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
    </Modal>
  );
}
