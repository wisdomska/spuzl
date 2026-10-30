"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BayStyles } from "@/games/_shared/BayStyles";
import { COLS, ROWS, drop, dropRow, type Grid } from "./engine";
import { COPY, replay, type FourUpPuzzle, type FourUpState } from "./logic";

const GAP = 4;

/**
 * Four Up Daily board (Board Games B8). Tap a column; the disc drops with gravity (ease-in-out
 * 280 ms, one bounce). Your discs carry a star, theirs a ring. Any drop that keeps the forced win is
 * answered by the rival's longest defence; the winning four rings lime.
 */
export default function FourUpBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<FourUpPuzzle, FourUpState>) {
  const [cols, setCols] = useState<number[]>(() => initialState?.cols?.slice() ?? []);
  const r = useMemo(() => replay(puzzle, cols), [puzzle, cols]);
  const [shown, setShown] = useState<Grid>(r.grid);
  const [fresh, setFresh] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState<{ cell: number; n: number }>({ cell: -1, n: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streak = useRef(0);
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
      api.announce(`Star disc in column ${c + 1}, row ${ROWS - row}`);
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
          api.feedback(`They block column ${reply + 1}. Win in ${left} more.`, "info", "hand-pointing");
          api.announce(`Ring disc in column ${reply + 1}. Win in ${left} more.`);
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
    api.feedback(`Win in ${puzzle.winIn} drops. Tap a column.`, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(ROWS, COLS, (i) => dropCol(i % COLS));
  const hintCol = typeof hint?.target === "number" ? hint.target : -1;

  return (
    <div className="flex flex-col items-center gap-3" data-board="fourup">
      <BayStyles />
      <div className="flex w-full items-center gap-2.5 text-[16px] font-semibold">
        <span
          aria-hidden
          className="flex size-5 items-center justify-center rounded-full"
          style={{ background: "#F4F5FB", color: "#0E0F1A", boxShadow: "0 0 0 2px var(--line)" }}
        >
          <Icon name="star" size={12} />
        </span>
        You are the star. Win in {puzzle.winIn} drops.
      </div>
      <div
        role="grid"
        aria-label={`Four Up board, ${COLS} columns by ${ROWS} rows. Space drops a disc in the focused column.`}
        aria-rowcount={ROWS}
        aria-colcount={COLS}
        onKeyDown={keys.onKeyDown}
        className={`grid rounded-[18px] p-2 ${done ? "board-pulse" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${COLS}, ${cell}px)`,
          gap: GAP,
          background: "var(--world)",
          boxShadow: "inset 0 -6px 0 rgba(0,0,0,.2)",
        }}
      >
        {Array.from({ length: ROWS }, (_, row) => (
          <div role="row" key={row} className="contents">
            {Array.from({ length: COLS }, (_, c) => {
              const i = row * COLS + c;
              const v = shown[i];
              const isWin = winLine.has(i);
              const isBad = bad.cell === i;
              const drops = i === fresh;
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  data-col={c}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Column ${c + 1}, row ${ROWS - row}, ${v === 1 ? "star disc" : v === 2 ? "ring disc" : "empty"}${isWin ? ", winning four" : ""}`}
                  onClick={() => {
                    keys.setFocus(i);
                    dropCol(c);
                  }}
                  className={`relative cursor-pointer overflow-visible rounded-full outline-none ${c === hintCol && row === 0 ? "hint-ring" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    background: "#2A1630",
                    boxShadow: c === hintCol ? "0 0 0 3px var(--gold)" : undefined,
                  }}
                >
                  {!!v && (
                    <span
                      key={`${i}-${isBad ? bad.n : 0}`}
                      aria-hidden
                      className={`absolute inset-0 flex items-center justify-center rounded-full ${isBad ? "bay-shake" : ""}`}
                      style={{
                        background: v === 1 ? "#F4F5FB" : "#0E0F1A",
                        color: v === 1 ? "#0E0F1A" : "var(--world)",
                        boxShadow: isWin
                          ? "0 0 0 3px var(--accent)"
                          : isBad
                            ? "0 0 0 3px var(--danger)"
                            : v === 2
                              ? "inset 0 0 0 2px var(--world)"
                              : "inset 0 -3px 0 #C3B6D2",
                        ["--drop-from" as string]: `-${(row + 1) * (cell + GAP) + 8}px`,
                        animation: drops && !isBad ? "bay-drop 280ms var(--ease-in-out) both" : undefined,
                        zIndex: 1,
                      }}
                    >
                      <Icon name={v === 1 ? "star" : "circle"} size={Math.round(cell * 0.4)} />
                    </span>
                  )}
                  {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-full" style={{ zIndex: 2 }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
