"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { play } from "@/lib/audio";
import { BayStyles } from "@/games/_shared/BayStyles";
import { logicGames } from "@/lib/copy/logic-games";
import { COLS, ROWS, drop, dropRow, type Grid } from "./engine";
import { COPY, replay, type FourUpPuzzle, type FourUpState } from "./logic";

const t = logicGames.fourup;
const GAP = 4;
/* Disc materials (Board Games B8), the same in both themes. */
const STAR_BG = "#F4F5FB";
const INK = "#0E0F1A";
const HOLE = "#2A1630";
const STAR_LIP = "#C3B6D2";

/**
 * Four Up Daily board (Board Games B8). Each whole column is one full-height button, so a tap
 * anywhere in it drops there; hovering, focusing or pressing a column shows a ghost disc where it
 * would land. The disc drops with gravity (ease-in-out 280 ms, one bounce). Your discs carry a
 * star, theirs a ring. Any drop that keeps the forced win is answered by the rival's longest
 * defence; the winning four rings lime.
 */
export default function FourUpBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<FourUpPuzzle, FourUpState>) {
  const [cols, setCols] = useState<number[]>(() => initialState?.cols?.slice() ?? []);
  const r = useMemo(() => replay(puzzle, cols), [puzzle, cols]);
  const [shown, setShown] = useState<Grid>(r.grid);
  const [fresh, setFresh] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState<{ cell: number; n: number }>({ cell: -1, n: 0 });
  /** column under the pointer, focus or press: shows the drop preview */
  const [preview, setPreview] = useState(-1);
  const [focusCol, setFocusCol] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streak = useRef(0);
  const colsEl = useRef<(HTMLButtonElement | null)[]>([]);
  const cell = useCellSize(COLS, GAP, 16, 52);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const done = r.won;
  const winLine = new Set(r.line ?? []);

  const dropCol = useCallback(
    (c: number) => {
      if (disabled || done || busy) return;
      const row = dropRow(shown, c);
      if (row < 0) {
        api.ruleBreak(COPY.full);
        return;
      }
      const at = row * COLS + c;
      const g = drop(shown, c, 1);
      play("clack");
      setShown(g);
      setFresh(at);
      setBusy(true);
      api.announce(t.dropped(c + 1, ROWS - row));
      const next = [...cols, c];
      later(() => {
        const res = replay(puzzle, next);
        if (res.wrongAt >= 0) {
          streak.current = 0;
          setBad((b) => ({ cell: at, n: b.n + 1 }));
          api.ruleBreak(COPY.wrong);
          api.onMove({ cols }, { mistake: true });
          later(() => {
            setShown(r.grid);
            setFresh(-1);
            setBad({ cell: -1, n: 0 });
            setBusy(false);
          }, 900);
          return;
        }
        streak.current++;
        setCols(next);
        if (res.won) {
          setBusy(false);
          play("jingle");
          api.feedback(COPY.win, "success", "check-circle");
          api.announce(COPY.win);
          api.onMove({ cols: next }, { correctStreak: streak.current });
          api.onSolved({ cols: next });
          return;
        }
        api.onMove({ cols: next }, { correctStreak: streak.current });
        later(() => {
          const reply = res.plies[res.plies.length - 1].col;
          const rr = dropRow(g, reply);
          play("clack");
          setShown(res.grid);
          setFresh(rr * COLS + reply);
          setBusy(false);
          const left = puzzle.winIn - res.good;
          api.feedback(t.block(reply + 1, left), "info", "hand-pointing");
          api.announce(t.blockAnnounce(reply + 1, left));
        }, 450);
      }, 300);
    },

    [api, busy, cols, disabled, done, puzzle, r.grid, shown],
  );

  const undo = useCallback(() => {
    if (busy || done || !cols.length) return;
    const next = cols.slice(0, -1);
    setCols(next);
    setShown(replay(puzzle, next).grid);
    setFresh(-1);
    api.onMove({ cols: next });
  }, [api, busy, cols, done, puzzle]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: busy || done || !cols.length },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, busy, done, cols.length]);

  useEffect(() => {
    api.feedback(t.start(puzzle.winIn), "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roving focus across the column buttons: one Tab stop, arrows move, Enter or Space drops.
  const onKeyDown = (e: KeyboardEvent) => {
    const to =
      e.key === "ArrowLeft"
        ? Math.max(0, focusCol - 1)
        : e.key === "ArrowRight"
          ? Math.min(COLS - 1, focusCol + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? COLS - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    setFocusCol(to);
    colsEl.current[to]?.focus();
  };

  const hintCol = typeof hint?.target === "number" ? hint.target : -1;
  const live = !disabled && !done && !busy;
  const colH = ROWS * cell + (ROWS - 1) * GAP;

  return (
    <div className="flex flex-col items-center gap-3" data-board="fourup">
      <BayStyles />
      <div className="flex w-full items-center gap-2.5 text-[16px] font-semibold">
        <span
          aria-hidden
          className="flex size-5 items-center justify-center rounded-full"
          style={{ background: STAR_BG, color: INK, boxShadow: "0 0 0 2px var(--line)" }}
        >
          <Icon name="star" size={12} />
        </span>
        {t.you(puzzle.winIn)}
      </div>
      <div
        role="group"
        aria-label={t.boardLabel(COLS, ROWS)}
        onKeyDown={onKeyDown}
        className={`flex rounded-[18px] ${done ? "board-pulse" : ""}`}
        style={{
          padding: `8px ${8 - GAP / 2}px`,
          background: "var(--world)",
          boxShadow: "inset 0 -6px 0 rgba(0,0,0,.2)",
        }}
      >
        {Array.from({ length: COLS }, (_, c) => {
          const land = dropRow(shown, c);
          const ghost = live && preview === c && land >= 0;
          const discs: string[] = [];
          for (let row = ROWS - 1; row >= 0; row--) {
            const v = shown[row * COLS + c];
            if (v) discs.push(t.disc(ROWS - row, v === 1, winLine.has(row * COLS + c)));
          }
          return (
            <button
              key={c}
              ref={(el) => {
                colsEl.current[c] = el;
              }}
              type="button"
              data-col={c}
              data-no-tick
              tabIndex={focusCol === c ? 0 : -1}
              aria-label={t.column(c + 1, land >= 0 ? ROWS - land : null, discs)}
              aria-disabled={!live || land < 0 || undefined}
              onClick={() => {
                setFocusCol(c);
                dropCol(c);
              }}
              onPointerEnter={() => setPreview(c)}
              onPointerDown={() => setPreview(c)}
              onPointerLeave={() => setPreview((p) => (p === c ? -1 : p))}
              onFocus={() => {
                setFocusCol(c);
                setPreview(c);
              }}
              onBlur={() => setPreview((p) => (p === c ? -1 : p))}
              className={`flex touch-manipulation flex-col rounded-[14px] outline-none select-none focus-visible:shadow-[0_0_0_3px_var(--accent)] ${live && land >= 0 ? "cursor-pointer" : "cursor-default"} ${c === hintCol ? "hint-ring" : ""}`}
              style={{
                width: cell + GAP,
                height: colH,
                padding: `0 ${GAP / 2}px`,
                gap: GAP,
                boxSizing: "content-box",
                background: preview === c && live ? "color-mix(in srgb, var(--surface) 22%, transparent)" : "transparent",
                boxShadow: c === hintCol ? "0 0 0 3px var(--gold)" : undefined,
              }}
            >
              {Array.from({ length: ROWS }, (_, row) => {
                const i = row * COLS + c;
                const v = shown[i];
                const isWin = winLine.has(i);
                const isBad = bad.cell === i;
                const drops = i === fresh;
                return (
                  <span
                    key={i}
                    aria-hidden
                    data-i={i}
                    className="relative block shrink-0 overflow-visible rounded-full"
                    style={{ width: cell, height: cell, background: HOLE }}
                  >
                    {ghost && row === land && (
                      <span
                        data-ghost
                        className="absolute inset-0 flex items-center justify-center rounded-full"
                        style={{ background: STAR_BG, color: INK, opacity: 0.5, border: `2px dashed ${INK}` }}
                      >
                        <Icon name="star" size={Math.round(cell * 0.4)} />
                      </span>
                    )}
                    {!!v && (
                      <span
                        key={`${i}-${isBad ? bad.n : 0}`}
                        className={`absolute inset-0 flex items-center justify-center rounded-full ${isBad ? "bay-shake" : ""}`}
                        style={{
                          background: v === 1 ? STAR_BG : INK,
                          color: v === 1 ? INK : "var(--world)",
                          boxShadow: isWin
                            ? "0 0 0 3px var(--accent)"
                            : isBad
                              ? "0 0 0 3px var(--danger)"
                              : v === 2
                                ? "inset 0 0 0 2px var(--world)"
                                : `inset 0 -3px 0 ${STAR_LIP}`,
                          ["--drop-from" as string]: `-${(row + 1) * (cell + GAP) + 8}px`,
                          animation: drops && !isBad ? "bay-drop 280ms var(--ease-in-out) both" : undefined,
                          zIndex: 1,
                        }}
                      >
                        <Icon name={v === 1 ? "star" : "circle"} size={Math.round(cell * 0.4)} />
                      </span>
                    )}
                    {isBad && <span className="hatch absolute inset-0 rounded-full" style={{ zIndex: 2 }} />}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
