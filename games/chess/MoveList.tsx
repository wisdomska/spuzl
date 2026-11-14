"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { boardGames } from "@/lib/copy/board-games";
import { movePairs } from "./history";

const tc = boardGames.chess;

export interface MoveListProps {
  sans: readonly string[];
  /** the position on the board: 0 is the start, sans.length the game as it stands */
  shown: number;
  /** stepping through earlier positions is possible (the game replays) */
  canReview: boolean;
  onJump: (ply: number) => void;
  onFlip: () => void;
  /** black moved first (a set-up position) */
  firstBlack?: boolean;
}

/** Keeps `el` in view inside its scrolling parent `box`, without scrolling the page. */
function keepInView(box: HTMLElement | null, el: HTMLElement | null, axis: "x" | "y") {
  if (!box || !el) return;
  if (axis === "y") {
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight;
  } else {
    const left = el.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft) box.scrollLeft = left - 8;
    else if (left + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = left + el.offsetWidth - box.clientWidth + 8;
  }
}

function StepButton({ icon, label, onClick, off }: { icon: string; label: string; onClick: () => void; off: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={off || undefined}
      onClick={() => !off && onClick()}
      className={`press flex h-9 min-w-9 flex-1 items-center justify-center rounded-[10px] focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${off ? "text-muted opacity-50" : "bg-surface-raised"}`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/**
 * The full move list (wide screens, in the side panel): numbered pairs in standard notation, the move on the board
 * marked, any move a tap away, and the step buttons. While an earlier position is shown, "Back to the game" returns.
 */
export function MoveList({ sans, shown, canReview, onJump, onFlip, firstBlack }: MoveListProps) {
  const box = useRef<HTMLOListElement>(null);
  const total = sans.length;
  useEffect(() => {
    keepInView(box.current, box.current?.querySelector<HTMLElement>("[aria-current]") ?? null, "y");
  }, [shown, total]);
  const pairs = movePairs(sans, firstBlack);
  const offset = firstBlack ? 1 : 0;
  const reviewing = shown < total;
  return (
    <section className="bg-surface flex flex-col gap-1.5 rounded-[18px] p-2.5" aria-label={tc.moves} data-chess-moves>
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-muted flex-1 text-[13px] font-semibold tracking-[.04em] uppercase">{tc.moves}</h2>
        <button
          type="button"
          aria-label={tc.flip}
          title={tc.flip}
          onClick={onFlip}
          className="press text-muted hover:text-text flex size-9 items-center justify-center rounded-[10px]"
        >
          <Icon name="arrows-down-up" size={18} />
        </button>
      </div>
      {total === 0 ? (
        <p className="text-muted px-1 pb-1 text-[14px]">{tc.noMoves}</p>
      ) : (
        <ol
          ref={box}
          className="num grid max-h-[26dvh] grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto overscroll-contain text-[15px] font-medium"
        >
          {pairs.map((row, k) => (
            <li key={k} className="contents">
              <span className="text-muted px-1 py-1">{row.n}.</span>
              {[row.white, row.black].map((m, j) => {
                const ply = k * 2 + j + 1 - offset;
                if (m === null) return <span key={j} />;
                const current = ply === shown;
                return (
                  <button
                    key={j}
                    type="button"
                    aria-current={current || undefined}
                    disabled={!canReview}
                    onClick={() => onJump(ply)}
                    className={`rounded-[8px] px-1.5 py-1 text-left disabled:cursor-default ${current ? "bg-[var(--accent)] text-[var(--square-ink)]" : canReview ? "hover:bg-surface-raised" : ""}`}
                  >
                    {m}
                  </button>
                );
              })}
            </li>
          ))}
        </ol>
      )}
      {canReview && total > 0 && (
        <div className="flex gap-1.5">
          <StepButton icon="caret-line-left" label={tc.start} off={shown === 0} onClick={() => onJump(0)} />
          <StepButton icon="caret-left" label={tc.back} off={shown === 0} onClick={() => onJump(shown - 1)} />
          <StepButton icon="caret-right" label={tc.forward} off={!reviewing} onClick={() => onJump(shown + 1)} />
          <StepButton icon="caret-line-right" label={tc.latest} off={!reviewing} onClick={() => onJump(total)} />
        </div>
      )}
      {reviewing && (
        <button
          type="button"
          onClick={() => onJump(total)}
          className="press bg-accent text-on-accent flex h-10 items-center justify-center gap-2 rounded-[12px] text-[14px] font-bold"
        >
          <Icon name="play" size={16} />
          {tc.live}
        </button>
      )}
    </section>
  );
}

/**
 * The phone strip under the board: back, the moves in one scrolling line (the shown one marked, a tap away), forward,
 * and the flip button, or "Live" while an earlier position is shown.
 */
export function MoveStrip({ sans, shown, canReview, onJump, onFlip, firstBlack, width }: MoveListProps & { width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const total = sans.length;
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("[aria-current]") ?? null;
    if (el) keepInView(box.current, el, "x");
    else if (box.current) box.current.scrollLeft = shown === 0 ? 0 : box.current.scrollWidth;
  }, [shown, total]);
  const offset = firstBlack ? 1 : 0;
  const reviewing = shown < total;
  return (
    <div
      className="bg-surface flex h-10 max-w-full items-center gap-1 rounded-[14px] px-1"
      style={{ width }}
      role="group"
      aria-label={tc.moves}
      data-chess-moves
    >
      {canReview && <StepButton icon="caret-left" label={tc.back} off={shown === 0} onClick={() => onJump(shown - 1)} />}
      <div
        ref={box}
        className="num flex min-w-0 flex-[6] [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 text-[14px] font-medium whitespace-nowrap [&::-webkit-scrollbar]:hidden"
      >
        {total === 0 && <span className="text-muted px-1">{tc.noMoves}</span>}
        {sans.map((m, i) => {
          const ply = i + 1;
          const num = (i + offset) % 2 === 0 ? `${(i + offset) / 2 + 1}.` : i === 0 ? `${(offset + 1) / 2}…` : null;
          const current = ply === shown;
          return (
            <span key={i} className="flex flex-none items-center gap-1">
              {num && <span className="text-muted">{num}</span>}
              <button
                type="button"
                aria-current={current || undefined}
                disabled={!canReview}
                onClick={() => onJump(ply)}
                className={`rounded-[6px] px-1.5 py-0.5 disabled:cursor-default ${current ? "bg-[var(--accent)] text-[var(--square-ink)]" : "text-text"}`}
              >
                {m}
              </button>
            </span>
          );
        })}
      </div>
      {canReview && <StepButton icon="caret-right" label={tc.forward} off={!reviewing} onClick={() => onJump(shown + 1)} />}
      {reviewing ? (
        <button
          type="button"
          aria-label={tc.live}
          onClick={() => onJump(total)}
          className="press bg-accent text-on-accent flex h-9 flex-none items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-bold"
        >
          <Icon name="play" size={14} />
          {tc.liveShort}
        </button>
      ) : (
        <button
          type="button"
          aria-label={tc.flip}
          title={tc.flip}
          onClick={onFlip}
          className="press text-muted flex size-9 flex-none items-center justify-center rounded-[10px]"
        >
          <Icon name="arrows-down-up" size={18} />
        </button>
      )}
    </div>
  );
}
