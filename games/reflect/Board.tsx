"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { isPlayerCell, mirrorOf, mismatches, playerCells, type ReflectPuzzle, type ReflectState } from "./logic";

const GAP = 3;
const INK = "#0E0F1A";
const FILL = ["transparent", "var(--world)", "var(--text)"];
const GLYPH = ["", "square", "circle"];
const NAME = ["empty", "filled", "second colour"];

/**
 * Reflect board. The given half sits on the far side of a dashed axis; tap a cell on your side to cycle
 * empty → fill (→ second colour). A cell that does not match its mirror shakes, hatches and rings.
 */
export default function ReflectBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<ReflectPuzzle, ReflectState>) {
  const n = puzzle.size;
  const [cells, setCells] = useState<ReflectState>(() => initialState?.slice() ?? puzzle.given.map((g) => Math.max(0, g)));
  const [hist, setHist] = useState<ReflectState[]>([]);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef(cells);
  const streak = useRef(0);
  const cell = useCellSize(n, GAP, 12, 52);
  const players = playerCells(puzzle);
  const bad = new Set(mismatches(puzzle, cells));
  const target = players.filter((i) => puzzle.given[mirrorOf(n, puzzle.axis, i)] > 0).length;
  const placed = players.filter((i) => cells[i] > 0).length;

  const set = useCallback(
    (i: number, v: number) => {
      if (disabled || done || puzzle.given[i] >= 0) return;
      const prev = ref.current;
      if (prev[i] === v) return;
      const next = prev.slice();
      next[i] = v;
      ref.current = next;
      setCells(next);
      setHist((h) => [...h, prev]);
      setLast(i);
      setTapN((t) => t + 1);
      const r = Math.floor(i / n) + 1,
        c = (i % n) + 1;
      const src = puzzle.given[mirrorOf(n, puzzle.axis, i)];
      const broke = v !== 0 && v !== src;
      const clear = players.every((j) => next[j] === puzzle.given[mirrorOf(n, puzzle.axis, j)]);
      if (broke) {
        streak.current = 0;
        const msg = src === 0 ? "Its mirror is empty." : "Its mirror is a different colour.";
        api.ruleBreak(msg);
        api.announce(`Row ${r}, column ${c}, ${NAME[v]}. ${msg}`);
      } else if (clear) {
        setDone(true);
        play("jingle");
        api.feedback("Perfect mirror. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else {
        if (v) streak.current++;
        play("pop", { step: streak.current });
        api.announce(`Row ${r}, column ${c}, ${NAME[v]}`);
        const count = players.filter((j) => next[j] > 0).length;
        api.feedback(
          mode === "tutorial" && count === 1 ? "Match each cell to the one across the axis." : `${count} of ${target} cells`,
          "info",
          "flip-horizontal",
        );
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (clear) api.onSolved(next);
    },
    [api, disabled, done, mode, n, players, puzzle, target],
  );

  const cycle = useCallback(
    (i: number) => {
      if (puzzle.given[i] >= 0) {
        api.announce("This cell is part of the given half.");
        return;
      }
      set(i, (ref.current[i] + 1) % (puzzle.colors + 1));
    },
    [api, puzzle.colors, puzzle.given, set],
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

  const clearAll = useCallback(() => {
    const prev = ref.current;
    if (done) return;
    const next = puzzle.given.map((g) => Math.max(0, g));
    ref.current = next;
    setCells(next);
    setHist((h) => [...h, prev]);
    play("tick");
    api.onMove(next);
    api.feedback(`0 of ${target} cells`, "info", "flip-horizontal");
  }, [api, done, puzzle.given, target]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "clear", label: "Clear", icon: "eraser", onPress: clearAll, disabled: !placed || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, clearAll, hist.length, placed, done]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Tap your side to copy the pattern in a mirror." : `0 of ${target} cells`,
      "info",
      mode === "tutorial" ? "hand-pointing" : "flip-horizontal",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, cycle);
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const lastR = Math.floor(last / n),
    lastC = last % n;
  const pitch = cell + GAP;
  const side = n * pitch - GAP;
  const axisWord = puzzle.axis === "v" ? "vertical" : puzzle.axis === "h" ? "horizontal" : "diagonal";

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "min(100%, calc(100vw - 36px))" }}>
      <div className="relative rounded-[20px] p-1.5" style={{ background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)" }}>
        <div
          role="grid"
          aria-label={`Reflect board, ${n} by ${n}, ${axisWord} mirror`}
          aria-rowcount={n}
          aria-colcount={n}
          onKeyDown={keys.onKeyDown}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)`, gap: GAP, perspective: 600 }}
        >
          {Array.from({ length: n }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c;
                const v = cells[i];
                const mine = isPlayerCell(n, puzzle.axis, i);
                const isBad = bad.has(i);
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                let anim = "";
                if (!done && i === last)
                  anim = isBad ? (tapN % 2 ? "cell-shake-a" : "cell-shake-b") : tapN % 2 ? "cell-pop-a" : "cell-pop-b";
                const glow = i === hintTarget;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-readonly={!mine}
                    aria-selected={v > 0}
                    aria-label={`Row ${r + 1}, column ${c + 1}, ${mine ? "" : "given, "}${NAME[v]}${isBad ? ", does not mirror" : ""}`}
                    onClick={() => {
                      keys.setFocus(i);
                      cycle(i);
                    }}
                    className={`relative flex items-center justify-center rounded-[8px] outline-none focus-visible:z-10 ${mine ? "cursor-pointer" : ""} ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      background: v ? FILL[v] : mine ? "var(--surface-raised)" : "var(--surface)",
                      opacity: !mine && !done ? 0.82 : 1,
                      color: INK,
                      boxShadow: glow
                        ? "inset 0 0 0 4px var(--accent)"
                        : isBad
                          ? "inset 0 0 0 3px var(--danger)"
                          : mine && !v
                            ? "inset 0 0 0 1px var(--line)"
                            : undefined,
                    }}
                  >
                    {done && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-[8px]"
                        style={{
                          background: v ? FILL[v] : "color-mix(in srgb, var(--world) 30%, var(--surface))",
                          animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both`,
                        }}
                      />
                    )}
                    {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-[8px]" />}
                    {v > 0 && (
                      <Icon
                        name={GLYPH[v]}
                        size={Math.round(cell * 0.32)}
                        className="relative opacity-60"
                        style={{ color: v === 2 ? "var(--bg)" : INK }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* the mirror axis */}
        <svg
          aria-hidden
          className="pointer-events-none absolute overflow-visible"
          style={{ left: 6, top: 6 }}
          width={side}
          height={side}
          stroke="var(--accent)"
          strokeWidth={3}
          strokeDasharray="8 6"
          strokeLinecap="round"
        >
          {puzzle.axis === "v" && <line x1={side / 2} y1={-4} x2={side / 2} y2={side + 4} />}
          {puzzle.axis === "h" && <line x1={-4} y1={side / 2} x2={side + 4} y2={side / 2} />}
          {puzzle.axis === "d" && <line x1={0} y1={0} x2={side} y2={side} />}
        </svg>
      </div>
    </div>
  );
}
