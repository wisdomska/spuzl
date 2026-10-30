"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { analyze, runsOf, type SumsPuzzle, type SumsState } from "./logic";

const GAP = 2;

/**
 * Sums board (kakuro). Tap a white cell, then a number on the pad (or type 1 to 9). Clue cells show
 * the down sum bottom-left and the across sum top-right. Broken runs shake, hatch and ring.
 */
export default function SumsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<SumsPuzzle, SumsState>) {
  const { rows, cols } = puzzle;
  const runs = useMemo(() => runsOf(puzzle), [puzzle]);
  const firstWhite = puzzle.white.indexOf(1);
  const [cells, setCells] = useState<SumsState>(() => initialState?.slice() ?? new Array(rows * cols).fill(0));
  const [hist, setHist] = useState<SumsState[]>([]);
  const [sel, setSel] = useState(firstWhite);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef(cells);
  const streak = useRef(0);
  const cell = useCellSize(cols, GAP, 12, 54);
  const a = analyze(puzzle, cells, runs);
  const whites = puzzle.white.reduce((s, v) => s + v, 0);

  const put = useCallback(
    (i: number, v: number) => {
      if (disabled || done || !puzzle.white[i]) return;
      const prev = ref.current;
      if (prev[i] === v) return;
      const next = prev.slice();
      next[i] = v;
      ref.current = next;
      setCells(next);
      setHist((h) => [...h, prev]);
      setLast(i);
      setTapN((t) => t + 1);
      const before = analyze(puzzle, prev, runs);
      const after = analyze(puzzle, next, runs);
      const broke = v !== 0 && after.bad.has(i) && (after.bad.size > before.bad.size || !before.bad.has(i));
      const r = Math.floor(i / cols) + 1, c = (i % cols) + 1;
      if (broke) {
        streak.current = 0;
        api.ruleBreak(after.message);
        api.announce(`Row ${r}, column ${c}, ${v}. ${after.message}`);
      } else if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback("Every run adds up. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else {
        if (v) streak.current++;
        play(v ? "pop" : "tick", { step: streak.current });
        api.announce(`Row ${r}, column ${c}, ${v || "empty"}`);
        api.feedback(mode === "tutorial" && after.filled === 1 ? "Each run adds to its clue. No repeats in a run." : `${after.filled} of ${whites} filled`, "info", "plus-minus");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, cols, disabled, done, mode, puzzle, runs, whites],
  );

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      ref.current = prev;
      setCells(prev);
      play("tick");
      api.onMove(prev);
      return h.slice(0, -1);
    });
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? "Tap a cell, then a number. Runs add to the clue." : `0 of ${whites} filled`, "info", mode === "tutorial" ? "hand-pointing" : "plus-minus");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (i: number) => {
      if (!puzzle.white[i]) {
        const down = puzzle.down[i], right = puzzle.right[i];
        if (down || right) api.announce(`Clue. ${right ? `Across ${right}.` : ""} ${down ? `Down ${down}.` : ""}`);
        return;
      }
      setSel(i);
      play("tick");
    },
    [api, puzzle],
  );
  const keys = useGridKeys(rows, cols, select);
  const onKey = (e: KeyboardEvent) => {
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      setSel(keys.focus);
      put(keys.focus, Number(e.key));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      put(keys.focus, 0);
      return;
    }
    keys.onKeyDown(e);
  };

  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const lastR = Math.floor(last / cols), lastC = last % cols;
  const selRuns = runs.filter((r) => r.cells.includes(sel));
  const inSelRun = new Set(selRuns.flatMap((r) => r.cells));
  const font = Math.round(cell * 0.46);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "min(100%, calc(100vw - 36px))" }}>
        <div
          role="grid"
          aria-label={`Sums board, ${rows} by ${cols}`}
          aria-rowcount={rows}
          aria-colcount={cols}
          onKeyDown={onKey}
          className="grid rounded-[20px] p-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gap: GAP, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
        >
          {Array.from({ length: rows }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                const isWhite = !!puzzle.white[i];
                const v = cells[i];
                const bad = a.bad.has(i);
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                let anim = "";
                if (!done && i === last) anim = bad ? (tapN % 2 ? "cell-shake-a" : "cell-shake-b") : tapN % 2 ? "cell-pop-a" : "cell-pop-b";
                if (!isWhite) {
                  const down = puzzle.down[i], right = puzzle.right[i];
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      data-i={i}
                      tabIndex={keys.focus === i ? 0 : -1}
                      aria-readonly
                      aria-label={down || right ? `Clue${right ? `, across ${right}` : ""}${down ? `, down ${down}` : ""}` : "Block"}
                      onClick={() => keys.setFocus(i)}
                      className="num relative rounded-[6px] outline-none"
                      style={{ width: cell, height: cell, background: "color-mix(in srgb, var(--text) 9%, var(--board-bg))" }}
                    >
                      {(down > 0 || right > 0) && (
                        <>
                          <svg aria-hidden className="absolute inset-0" width={cell} height={cell}>
                            <line x1={3} y1={3} x2={cell - 3} y2={cell - 3} stroke="var(--line)" strokeWidth={1.5} />
                          </svg>
                          {right > 0 && <span className="absolute top-[3px] right-[5px] text-[13px] font-semibold text-[var(--text)]">{right}</span>}
                          {down > 0 && <span className="absolute bottom-[3px] left-[5px] text-[13px] font-semibold text-[var(--text)]">{down}</span>}
                        </>
                      )}
                    </div>
                  );
                }
                const isSel = sel === i && !done;
                const glow = i === hintTarget;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-selected={isSel}
                    aria-label={`Row ${r + 1}, column ${c + 1}, ${v || "empty"}${bad ? ", breaks a rule" : ""}`}
                    onClick={() => {
                      keys.setFocus(i);
                      select(i);
                    }}
                    className={`num relative flex cursor-pointer items-center justify-center rounded-[6px] bg-[var(--surface-raised)] font-semibold outline-none focus-visible:z-10 [[data-theme=light]_&]:bg-[var(--surface)] ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      fontSize: font,
                      ...(inSelRun.has(i) && !done ? { background: "color-mix(in srgb, var(--world) 16%, var(--surface-raised))" } : {}),
                      color: bad ? "var(--danger)" : "var(--text)",
                      boxShadow: glow ? "inset 0 0 0 4px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : isSel ? "inset 0 0 0 3px var(--world)" : undefined,
                    }}
                  >
                    {done && (
                      <span aria-hidden className="absolute inset-0 rounded-[6px]" style={{ background: "var(--world)", animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both` }} />
                    )}
                    {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[6px]" />}
                    <span className="relative" style={done ? { color: "#0E0F1A" } : undefined}>
                      {v || ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid w-full grid-cols-5 gap-2" role="group" aria-label="Number pad" style={{ maxWidth: 358 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled || done}
            onClick={() => put(sel, d)}
            className="press num flex h-12 items-center justify-center rounded-[14px] text-[22px] font-semibold"
            style={{ background: "var(--surface-raised)", boxShadow: "0 4px 0 var(--depth)" }}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          aria-label="Erase"
          disabled={disabled || done}
          onClick={() => put(sel, 0)}
          className="press flex h-12 items-center justify-center rounded-[14px] text-muted"
          style={{ background: "var(--surface-raised)", boxShadow: "0 4px 0 var(--depth)" }}
        >
          <Icon name="backspace" size={22} />
        </button>
      </div>
    </div>
  );
}
