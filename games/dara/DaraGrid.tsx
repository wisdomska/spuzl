"use client";

import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { BayStyles } from "@/games/_shared/BayStyles";
import { dara as t } from "@/lib/copy/dara";
import { COLS, ROWS, type Board } from "./rules";

export interface DaraGridProps {
  board: Board;
  /** which stone value is "yours" (1 or 2) */
  mine?: number;
  selected?: number | null;
  /** empty cells you can step or drop to now */
  targets?: number[];
  /** "step here" or "drop here" */
  targetLabel?: string;
  /** their stones you can take now */
  takeable?: number[];
  /** your stones that have a step */
  movable?: number[];
  /** cells of the last move (from and to) */
  last?: number[];
  /** cells of a three just made */
  line?: number[];
  hintCell?: number;
  disabled?: boolean;
  onTap: (i: number) => void;
}

const GAP = 2;
const PADDING = 8;

/**
 * The Dara board (5 rows × 6 columns) shared by the puzzle board and the vs-bot board. Every cell is a real
 * button named "Row r, column c, …" with what is on it and what a tap does. Your stones are light; theirs
 * are dark with a ring and a dot, so the sides never rely on colour alone.
 */
export function DaraGrid({
  board,
  mine = 1,
  selected = null,
  targets = [],
  targetLabel = t.stepHere,
  takeable = [],
  movable = [],
  last = [],
  line = [],
  hintCell = -1,
  disabled,
  onTap,
}: DaraGridProps) {
  const cell = useCellSize(COLS, GAP, PADDING, 60);
  const stone = Math.round(cell * 0.72);
  return (
    <>
      <BayStyles />
      <div
        role="grid"
        aria-label={t.grid}
        aria-rowcount={ROWS}
        aria-colcount={COLS}
        className="grid rounded-[16px] bg-[var(--bay-well)] p-1 shadow-[inset_0_-6px_0_rgba(0,0,0,.25)]"
        style={{ gridTemplateColumns: `repeat(${COLS}, ${cell}px)`, gap: GAP }}
      >
        {Array.from({ length: ROWS }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: COLS }, (_, c) => {
              const i = r * COLS + c;
              const v = board[i];
              const yours = v === mine;
              const target = targets.includes(i);
              const take = takeable.includes(i);
              const sel = selected === i;
              const can = movable.includes(i);
              const inLine = line.includes(i);
              const parts = [
                t.where(r + 1, c + 1),
                v ? (yours ? t.yours : t.theirs) : t.empty,
                sel ? t.picked : can && !disabled ? t.canMove : "",
                target ? targetLabel : "",
                take ? t.canTake : "",
                inLine ? t.inLine : "",
              ].filter(Boolean);
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  aria-label={parts.join(", ")}
                  aria-selected={sel}
                  onClick={() => onTap(i)}
                  className={`relative flex items-center justify-center rounded-[10px] ${i === hintCell ? "hint-ring" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    background: last.includes(i) ? "color-mix(in srgb, var(--w-board) 22%, var(--bay-wood))" : "var(--bay-wood)",
                    boxShadow:
                      i === hintCell
                        ? "inset 0 0 0 3px var(--gold)"
                        : inLine
                          ? "inset 0 0 0 3px var(--w-board)"
                          : "inset 0 3px 0 rgba(0,0,0,.25)",
                  }}
                >
                  {v ? (
                    <span
                      className={`flex items-center justify-center rounded-full ${sel ? "bay-pop" : ""}`}
                      style={{
                        width: stone,
                        height: stone,
                        transform: sel ? "translateY(-4px)" : undefined,
                        transition: "transform 160ms var(--ease-out)",
                        background: yours ? "var(--bay-disc-light)" : "var(--bay-disc-dark)",
                        boxShadow: yours
                          ? `inset 0 -4px 0 var(--bay-disc-light-rim)${sel ? ", 0 0 0 3px var(--accent)" : can && !disabled ? ", 0 0 0 2px var(--w-board)" : ""}`
                          : `inset 0 0 0 3px var(--w-board)${take ? ", 0 0 0 3px var(--danger)" : ""}`,
                        color: yours ? "var(--square-ink)" : "var(--w-board)",
                      }}
                    >
                      {!yours && <Icon name={take ? "x" : "circle"} size={take ? 18 : 10} />}
                    </span>
                  ) : target ? (
                    <span
                      aria-hidden
                      className="bay-dot size-3.5 rounded-full bg-[color-mix(in_srgb,var(--bay-disc-light)_60%,transparent)]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
