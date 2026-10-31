"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BayStyles } from "@/games/_shared/BayStyles";
import { flipsFor, legalSquares, sqName, type Grid } from "./engine";
import { options, type FlipPuzzle, type FlipState } from "./logic";

const WAVE_MS = 60;

/**
 * Flip Daily board (Board Games B8). Pink rings mark legal squares. Tap one to place a light disc;
 * outflanked discs flip with rotateY in a wave, 60 ms apart, nearest first. One square flips the
 * most. (The design's per-square flip counts would give the Daily away, so the puzzle shows rings
 * only; counts belong to Play mode.)
 */
export default function FlipBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<FlipPuzzle, FlipState>) {
  const legal = useMemo(() => new Set(legalSquares(puzzle.grid, 1)), [puzzle]);
  const best = useMemo(() => Math.max(...options(puzzle.grid).map((o) => o.flips)), [puzzle]);
  const [shown, setShown] = useState<Grid>(puzzle.grid);
  const [placed, setPlaced] = useState<number | null>(initialState?.sq ?? null);
  const [wave, setWave] = useState<Map<number, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [badN, setBadN] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cell = useCellSize(8, 0, 0, 48);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tap = useCallback(
    (sq: number) => {
      if (busy || done || disabled) return;
      if (shown[sq]) return;
      if (!legal.has(sq)) {
        api.ruleBreak("That square flips nothing. Pick a ring.");
        return;
      }
      const flips = flipsFor(puzzle.grid, sq, 1);
      const g = puzzle.grid.slice();
      g[sq] = 1;
      for (const f of flips) g[f] = 1;
      play("clack");
      setShown(g);
      setPlaced(sq);
      setBusy(true);
      setWave(new Map(flips.map((f, k) => [f, k])));
      flips.forEach((_, k) => timers.current.push(setTimeout(() => play("pop", { step: k }), (k + 1) * WAVE_MS)));
      api.announce(`Light disc on ${sqName(sq)}, ${flips.length} flipped`);
      timers.current.push(
        setTimeout(
          () => {
            if (flips.length === best) {
              setDone(true);
              setBusy(false);
              play("jingle");
              api.feedback(`Biggest flip: ${flips.length} discs.`, "success", "check-circle");
              api.onMove({ sq }, { correctStreak: 1 });
              api.onSolved({ sq });
            } else {
              setBadN((n) => n + 1);
              api.ruleBreak(`${flips.length} flipped. Another square flips more.`);
              api.onMove({ sq }, { mistake: true });
              timers.current.push(
                setTimeout(() => {
                  setShown(puzzle.grid);
                  setPlaced(null);
                  setWave(new Map());
                  setBusy(false);
                }, 1000),
              );
            }
          },
          flips.length * WAVE_MS + 360,
        ),
      );
    },
    [api, best, busy, disabled, done, legal, puzzle, shown],
  );

  useEffect(() => {
    api.setControls([{ id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" }]);
    api.feedback("Flip the most in one move. Rings are legal squares.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(8, 8, tap);
  const hintSq = typeof hint?.target === "number" ? hint.target : -1;
  const disc = Math.round(cell * 0.78);

  return (
    <div className="flex flex-col items-center" data-board="flip">
      <BayStyles />
      <div
        role="grid"
        aria-label="Flip board, you play light"
        aria-rowcount={8}
        aria-colcount={8}
        onKeyDown={keys.onKeyDown}
        className={`grid rounded-[16px] ${done ? "board-pulse" : ""}`}
        style={{ gridTemplateColumns: `repeat(8, ${cell}px)`, background: "#2A1630", boxShadow: "0 0 0 4px #2A1630", perspective: 600 }}
      >
        {Array.from({ length: 8 }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: 8 }, (_, c) => {
              const sq = r * 8 + c;
              const v = shown[sq];
              const ring = !v && legal.has(sq) && !busy && !done;
              const k = wave.get(sq);
              const isBad = placed === sq && badN > 0 && busy && !done;
              return (
                <div
                  key={sq}
                  role="gridcell"
                  data-i={sq}
                  tabIndex={keys.focus === sq ? 0 : -1}
                  aria-label={`${sqName(sq)}, ${v === 1 ? "light disc" : v === 2 ? "dark disc" : ring ? "legal square" : "empty"}`}
                  onClick={() => {
                    keys.setFocus(sq);
                    tap(sq);
                  }}
                  className={`relative flex cursor-pointer items-center justify-center outline-none ${sq === hintSq ? "hint-ring" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: 7,
                    background: "#3A2232",
                    boxShadow: `inset 0 0 0 1px #2A1630${sq === hintSq ? ", inset 0 0 0 4px var(--gold)" : ""}`,
                  }}
                >
                  {!!v && (
                    <span
                      key={`${sq}-${v}-${badN}`}
                      aria-hidden
                      className={`rounded-full ${placed === sq ? (isBad ? "bay-shake" : "bay-pop") : ""}`}
                      style={{
                        width: disc,
                        height: disc,
                        background: v === 1 ? "#F4F5FB" : "#0E0F1A",
                        boxShadow: v === 2 ? "inset 0 0 0 2px var(--world)" : isBad ? "0 0 0 3px var(--danger)" : "inset 0 -3px 0 #C3B6D2",
                        animation: k !== undefined ? `bay-flip 300ms var(--ease-out) ${k * WAVE_MS}ms both` : undefined,
                      }}
                    />
                  )}
                  {ring && <span aria-hidden className="size-4 rounded-full" style={{ boxShadow: "inset 0 0 0 3px var(--world)" }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
