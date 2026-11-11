"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize, useFitHeight } from "@/components/game/useBoardSize";
import { isKeyedInput, useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { sfx } from "@/games/_shared/sfx";
import { spreadOf } from "./fx";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { field, FLAG, flood, HIDDEN, neighbours, OPEN, TRIPPED, type TripwirePuzzle, type TripwireState } from "./logic";

const GAP = 3;
const PAD = 6;
/** Smallest cell on a short phone (the whole cell is the tap target). */
const MIN_CELL = 32;
const LONG_PRESS_MS = 420;
/** A flood opens outward from the tapped tile: this much later per step away, capped so big floods stay quick. */
const SPREAD_MS = 22;
const SPREAD_CAP_MS = 220;
/** Floods at least this big get an airy sweep under the pop. */
const SWEEP_FROM = 8;

/**
 * Tripwire board (minesweeper). Tap reveals, long-press or the Flag tool flags, tapping a number whose
 * flags are all placed opens the rest around it. The first tap is always safe and opens the start
 * patch. A wire tripped by mistake is shown, hatched, and counted; play goes on.
 */
export default function TripwireBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<TripwirePuzzle, TripwireState>) {
  const { w, h } = puzzle;
  const f = useMemo(() => field(puzzle), [puzzle]);
  const safeTotal = w * h - puzzle.mines.length;
  const [cells, setCells] = useState<TripwireState>(() => initialState?.slice() ?? new Array(w * h).fill(HIDDEN));
  const [hist, setHist] = useState<TripwireState[]>([]);
  const [flagTool, setFlagTool] = useState(false);
  const [popped, setPopped] = useState<number[]>([]);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const cellsRef = useRef(cells);
  const streak = useRef(0);
  const press = useRef<{ i: number; timer: ReturnType<typeof setTimeout> | null; fired: boolean } | null>(null);
  // The grid fits the width and the height (rows count), and the counts row above it and the tool bar must fit too:
  // useFitHeight measures the whole shell (on a wide screen, the board column) and steps the cells down.
  const root = useRef<HTMLDivElement>(null);
  const ideal = useCellSize(w, GAP, PAD * 2, 56, h);
  const cell = useFitHeight(ideal, Math.min(MIN_CELL, ideal), h, root, "shell");
  const locked = disabled || done;
  const opened = cells.filter((v, i) => v === OPEN && f[i] >= 0).length;
  const flags = cells.filter((v) => v === FLAG).length;
  const tripped = cells.filter((v) => v === TRIPPED).length;

  const where = (i: number) => `Row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}`;

  const commit = useCallback(
    (next: TripwireState, changed: number[], focus: number, info: { trip?: boolean; flag?: boolean }) => {
      const prev = cellsRef.current;
      cellsRef.current = next;
      setCells(next);
      setHist((hh) => [...hh, prev]);
      // Keyboard entry changes tiles without the pop (fast, repeated entry).
      setPopped(isKeyedInput() ? [] : changed);
      setLast(focus);
      setTapN((t) => t + 1);
      const open = next.filter((v, i) => v === OPEN && f[i] >= 0).length;
      const clear = open === safeTotal;
      if (info.trip) {
        streak.current = 0;
        setShakeN((k) => k + 1);
        api.ruleBreak("That was a wire. It counts as a mistake. Keep going.");
        api.announce(`${where(focus)}, wire tripped.`);
      } else if (info.flag) {
        if (next[focus] === FLAG) sfx.place(streak.current);
        else sfx.remove();
        api.announce(`${where(focus)}, ${next[focus] === FLAG ? "flagged" : "flag removed"}`);
      } else {
        streak.current += 1;
        sfx.place(streak.current);
        if (changed.length >= SWEEP_FROM) {
          const spread = Math.min(SPREAD_CAP_MS, spreadOf(changed, focus, w) * SPREAD_MS);
          play("swoosh", { duration: Math.max(0.12, spread / 1000), gain: 0.45, silentHaptic: true });
        }
        const n = f[focus];
        api.announce(changed.length > 1 ? `${changed.length} tiles opened` : `${where(focus)}, ${n === 0 ? "clear" : n}`);
      }
      if (clear) {
        const final = next.map((v, i) => (f[i] < 0 && v !== TRIPPED ? FLAG : v));
        cellsRef.current = final;
        setCells(final);
        setDone(true);
        api.feedback("Every safe tile found. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
        api.onMove(final, { correctStreak: streak.current, mistake: !!info.trip });
        api.onSolved(final);
        return;
      }
      if (!info.trip) api.feedback(`${open} of ${safeTotal} safe tiles`, "info", "bomb");
      api.onMove(next, { correctStreak: streak.current, mistake: !!info.trip });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, f, safeTotal],
  );

  const reveal = useCallback(
    (i: number) => {
      if (locked) return;
      const cur = cellsRef.current;
      if (cur[i] === FLAG || cur[i] === TRIPPED) return;
      const next = cur.slice();
      const changed: number[] = [];
      const openFrom = (j: number) =>
        flood(puzzle, f, next, j).forEach((k) => {
          next[k] = OPEN;
          changed.push(k);
        });
      // First tap: always safe. Open the start patch, plus the tapped tile when it is safe.
      if (!cur.includes(OPEN)) {
        openFrom(puzzle.start);
        if (f[i] >= 0) openFrom(i);
        if (f[i] < 0) api.feedback("First tap is always safe. Here is a clear patch to start from.", "info", "hand-pointing");
        commit(next, changed, i, {});
        return;
      }
      if (cur[i] === OPEN) {
        // Chord: a number with all its flags placed opens its other neighbours.
        const nb = neighbours(w, h, i);
        if (f[i] <= 0 || nb.filter((j) => cur[j] === FLAG || cur[j] === TRIPPED).length !== f[i]) return;
        const targets = nb.filter((j) => cur[j] === HIDDEN);
        if (!targets.length) return;
        const wire = targets.find((j) => f[j] < 0);
        if (wire !== undefined) {
          next[wire] = TRIPPED;
          commit(next, [wire], wire, { trip: true });
          return;
        }
        targets.forEach(openFrom);
        commit(next, changed, i, {});
        return;
      }
      if (f[i] < 0) {
        next[i] = TRIPPED;
        commit(next, [i], i, { trip: true });
        return;
      }
      openFrom(i);
      commit(next, changed, i, {});
    },
    [api, commit, f, h, locked, puzzle, w],
  );

  const toggleFlag = useCallback(
    (i: number) => {
      if (locked) return;
      const cur = cellsRef.current;
      if (cur[i] !== HIDDEN && cur[i] !== FLAG) return;
      const next = cur.slice();
      next[i] = cur[i] === FLAG ? HIDDEN : FLAG;
      commit(next, [i], i, { flag: true });
    },
    [commit, locked],
  );

  const act = useCallback(
    (i: number) => (flagTool && cellsRef.current[i] !== OPEN ? toggleFlag(i) : reveal(i)),
    [flagTool, reveal, toggleFlag],
  );

  const undo = useCallback(() => {
    setHist((hh) => {
      if (!hh.length) return hh;
      const prev = hh[hh.length - 1];
      cellsRef.current = prev;
      setCells(prev);
      setPopped([]);
      api.onMove(prev);
      return hh.slice(0, -1);
    });
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "flag", label: "Flag", icon: "flag", onPress: () => setFlagTool((t) => !t), active: flagTool },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done, flagTool]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Tap anywhere to start. The first tap is always safe." : "Tap to reveal, hold to flag. First tap is safe.",
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Long-press flags; a short tap acts with the current tool.
  const onPointerDown = (i: number) => () => {
    if (locked) return;
    press.current = {
      i,
      fired: false,
      timer: setTimeout(() => {
        if (press.current?.i !== i) return;
        press.current.fired = true;
        toggleFlag(i);
      }, LONG_PRESS_MS),
    };
  };
  const endPress = (i: number, tap: boolean) => {
    const p = press.current;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    press.current = null;
    if (tap && !p.fired && p.i === i) act(i);
  };

  // Keyboard: Space flags, Enter reveals.
  const keys = useGridKeys(h, w, toggleFlag, reveal);
  const lastR = Math.floor(last / w),
    lastC = last % w;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;

  return (
    <div ref={root} className={`short:gap-2 flex flex-col items-center gap-3 ${done ? "board-pulse" : ""}`}>
      <div className="num flex items-center gap-4 text-[14px] font-semibold text-[var(--text-muted)]" aria-hidden>
        <span className="flex items-center gap-1.5">
          <Icon name="bomb" size={16} />
          {puzzle.mines.length - flags - tripped} left
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="flag" size={16} />
          {flags}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="check-circle" size={16} />
          {opened} of {safeTotal}
        </span>
      </div>
      <div className="overflow-x-auto" style={{ maxWidth: "100%" }}>
        <div
          role="grid"
          aria-label={`Tripwire board, ${w} by ${h}, ${puzzle.mines.length} mines`}
          aria-rowcount={h}
          aria-colcount={w}
          onKeyDown={keys.onKeyDown}
          className="grid rounded-[16px] select-none"
          style={{
            gridTemplateColumns: `repeat(${w}, ${cell}px)`,
            gap: GAP,
            padding: PAD,
            background: "var(--board-bg)",
            boxShadow: "0 0 0 2px var(--line)",
            perspective: 600,
          }}
        >
          {Array.from({ length: h }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: w }, (_, c) => {
                const i = r * w + c;
                const v = cells[i];
                const n = f[i];
                const isOpen = v === OPEN;
                const trip = v === TRIPPED;
                const glow = i === hintTarget && !done;
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                let anim = "";
                if (!done && popped.includes(i)) anim = trip ? shakeClass(shakeN) : popClass(tapN);
                const delay = anim && !trip ? Math.min(SPREAD_CAP_MS, Math.max(Math.abs(r - lastR), Math.abs(c - lastC)) * SPREAD_MS) : 0;
                const label = trip ? "wire tripped" : v === FLAG ? "flagged" : isOpen ? (n ? `${n} mines around` : "clear") : "hidden";
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-label={`Row ${r + 1}, column ${c + 1}, ${label}`}
                    onFocus={() => keys.setFocus(i)}
                    onPointerDown={onPointerDown(i)}
                    onPointerUp={() => endPress(i, true)}
                    onPointerLeave={() => endPress(i, false)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!press.current?.fired) toggleFlag(i);
                    }}
                    className={`num relative flex cursor-pointer items-center justify-center rounded-[10px] font-semibold outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      // the count grows with the cell (big on a wide screen), never under 16 px
                      fontSize: Math.max(16, Math.round(cell * 0.46)),
                      background: trip
                        ? "var(--danger-tint)"
                        : isOpen
                          ? "var(--surface)"
                          : "color-mix(in srgb, var(--text-muted) 30%, var(--surface))",
                      boxShadow: glow
                        ? "inset 0 0 0 4px var(--accent)"
                        : trip
                          ? "inset 0 0 0 3px var(--danger)"
                          : !isOpen
                            ? "inset 0 -4px 0 rgb(0 0 0 / .22)"
                            : undefined,
                      color: trip ? "var(--danger)" : v === FLAG ? "var(--gold)" : undefined,
                      animationDelay: delay ? `${delay}ms` : undefined,
                    }}
                  >
                    {done && (
                      <span aria-hidden className="absolute inset-0" style={waveStyle(dist, n < 0 ? "var(--gold)" : "var(--world)", 10)} />
                    )}
                    {trip && <span aria-hidden className="hatch absolute inset-0 rounded-[10px]" />}
                    {trip && <Icon name="bomb" size={Math.round(cell * 0.5)} className="relative" />}
                    {v === FLAG && (
                      <Icon
                        name="flag"
                        size={Math.round(cell * 0.45)}
                        className="relative"
                        style={done ? { color: "#0E0F1A" } : undefined}
                      />
                    )}
                    {isOpen && n > 0 && (
                      <span
                        className={`relative ${done ? "" : "text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]"}`}
                        style={done ? { color: "#0E0F1A" } : undefined}
                      >
                        {n}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
