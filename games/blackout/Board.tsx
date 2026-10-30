"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { popClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { lit, neighbourhood, replay, type BlackoutPuzzle, type BlackoutState } from "./logic";

const GAP = 4;
const PAD = 6;

/**
 * Blackout board. Tap flips a tile and its four neighbours; every flipped tile pops together. Lit
 * tiles are world colour with a glowing bulb, dark tiles show an unlit bulb, so state never relies on
 * colour alone. The feedback line keeps moves against par; time is the score.
 */
export default function BlackoutBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<BlackoutPuzzle, BlackoutState>) {
  const n = puzzle.size;
  const [presses, setPresses] = useState<number[]>(() => initialState?.presses?.slice() ?? []);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [done, setDone] = useState(false);
  const pressesRef = useRef(presses);
  const cell = useCellSize(n, GAP, PAD * 2, 64);
  const lights = replay(puzzle, presses);
  const on = lit(lights);
  const locked = disabled || done;

  const tally = useCallback(
    (moves: number, left: number) => {
      const vs = moves <= puzzle.par ? `Par ${puzzle.par}` : `${moves - puzzle.par} over par`;
      return `${moves} ${moves === 1 ? "move" : "moves"}, ${vs}. ${left} lit.`;
    },
    [puzzle.par],
  );

  const tap = useCallback(
    (i: number) => {
      if (locked) return;
      const next = [...pressesRef.current, i];
      pressesRef.current = next;
      setPresses(next);
      setFlipped(neighbourhood(n, i));
      setLast(i);
      setTapN((t) => t + 1);
      const after = replay(puzzle, next);
      const left = lit(after);
      const state = { presses: next };
      if (!left) {
        setDone(true);
        play("jingle");
        const par = next.length <= puzzle.par ? "On par." : `${next.length - puzzle.par} over par.`;
        api.feedback(`Lights out in ${next.length} moves. ${par}`, "success", "check-circle");
        api.announce(`Board cleared in ${next.length} moves. Par ${puzzle.par}.`);
      } else {
        play("pop", { step: Math.max(1, n * n - left) });
        api.feedback(tally(next.length, left), "info", "lightbulb-filament");
        api.announce(`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1} flipped. ${left} lit.`);
      }
      api.onMove(state, { correctStreak: next.length });
      if (!left) api.onSolved(state);
    },
    [api, locked, n, puzzle, tally],
  );

  const undo = useCallback(() => {
    if (!pressesRef.current.length || done) return;
    const next = pressesRef.current.slice(0, -1);
    pressesRef.current = next;
    setPresses(next);
    setFlipped([]);
    api.onMove({ presses: next });
    api.feedback(tally(next.length, lit(replay(puzzle, next))), "info", "lightbulb-filament");
  }, [api, done, puzzle, tally]);

  const reset = useCallback(() => {
    if (!pressesRef.current.length || done) return;
    pressesRef.current = [];
    setPresses([]);
    setFlipped([]);
    api.onMove({ presses: [] });
    api.feedback(`Back to the start. Par ${puzzle.par}.`, "info", "arrows-clockwise");
  }, [api, done, puzzle.par]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !presses.length || done },
      { id: "reset", label: "Reset", icon: "arrows-clockwise", onPress: reset, disabled: !presses.length || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, reset, presses.length, done]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? `Tap a tile to flip it and its neighbours. Par ${puzzle.par}.` : `Par ${puzzle.par}. Turn every light off.`, "info", "lightbulb-filament");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, tap);
  const lastR = Math.floor(last / n), lastC = last % n;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;

  return (
    <div className={`flex flex-col items-center gap-3 ${done ? "board-pulse" : ""}`}>
      <div className="num flex items-center gap-4 text-[14px] font-semibold text-[var(--text-muted)]" aria-hidden>
        <span className="flex items-center gap-1.5">
          <Icon name="hand-tap" size={16} />
          {presses.length}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="flag-checkered" size={16} />
          Par {puzzle.par}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="lightbulb-filament" size={16} />
          {on} lit
        </span>
      </div>
      <div
        role="grid"
        aria-label={`Blackout board, ${n} by ${n}, ${on} lit, par ${puzzle.par}`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={keys.onKeyDown}
        className="grid rounded-[16px]"
        style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)`, gap: GAP, padding: PAD, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
      >
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const v = lights[i];
              const glow = i === hintTarget && !done;
              const anim = !done && flipped.includes(i) ? popClass(tapN) : "";
              const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${v ? "lit" : "off"}`}
                  aria-selected={!!v}
                  onClick={() => {
                    keys.setFocus(i);
                    tap(i);
                  }}
                  className={`relative flex cursor-pointer items-center justify-center rounded-[12px] outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    background: v ? "var(--world)" : "var(--surface-raised)",
                    color: v ? "#0E0F1A" : "color-mix(in srgb, var(--text-muted) 60%, transparent)",
                    boxShadow: glow ? "inset 0 0 0 4px var(--accent)" : v ? "0 0 18px color-mix(in srgb, var(--world) 45%, transparent)" : undefined,
                    transition: "background-color 120ms var(--ease-out), box-shadow 120ms var(--ease-out)",
                  }}
                >
                  {done && <span aria-hidden className="absolute inset-0" style={waveStyle(dist, "var(--world)", 12)} />}
                  <Icon name={v ? "lightbulb-filament" : "lightbulb"} size={Math.round(cell * (v ? 0.48 : 0.36))} className="relative" style={done ? { color: "#0E0F1A" } : undefined} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
