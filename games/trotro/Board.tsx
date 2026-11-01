"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { reducedMotion } from "@/games/_shared/logiclab/fx";
import { TROTRO_COPY as T } from "@/lib/copy/trotro";
import {
  directionOf,
  EXIT_COL,
  isSolved,
  occupancy,
  replay,
  room,
  vehicleName,
  type Move,
  type TrotroPuzzle,
  type TrotroState,
} from "./logic";

const GAP = 4;
const PAD = 8;
/** Extra room on the right for the exit mark. */
const EXIT_PAD = 12;
const DRAG_START = 6;

type Dir = "up" | "down" | "left" | "right";
const DIRS: { dir: Dir; icon: string; axis: "h" | "v"; step: number }[] = [
  { dir: "left", icon: "arrow-left", axis: "h", step: -1 },
  { dir: "up", icon: "arrow-up", axis: "v", step: -1 },
  { dir: "down", icon: "arrow-down", axis: "v", step: 1 },
  { dir: "right", icon: "arrow-right", axis: "h", step: 1 },
];
const KEY_DIR: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

/** Adds a slide to the log. A slide of the same vehicle as the last move joins it (one move, any distance). */
function pushMove(moves: Move[], m: Move): Move[] {
  const last = moves[moves.length - 1];
  if (last && last[0] === m[0]) {
    const d = last[1] + m[1];
    return d ? [...moves.slice(0, -1), [m[0], d]] : moves.slice(0, -1);
  }
  return [...moves, m];
}

/**
 * Trotro Jam board. The lot is a 6 × 6 grid of cells (each a gridcell named "Row r, column c, …"); the
 * vehicles are drawn on top and never take pointer events, so every tap lands on a cell. Tap a vehicle to
 * select it, then an arrow (or a free cell in its lane); or drag it along its lane. Keyboard: arrows move
 * the focus, Enter or Space selects, then arrows slide the selected vehicle and Escape lets go.
 */
export default function TrotroBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<TrotroPuzzle, TrotroState>) {
  const n = puzzle.size;
  const [moves, setMoves] = useState<Move[]>(() => (initialState?.moves && replay(puzzle, initialState.moves) ? initialState.moves : []));
  const [sel, setSel] = useState(-1);
  const [drag, setDrag] = useState<{ v: number; px: number } | null>(null);
  const [done, setDone] = useState(() => isSolved(replay(puzzle, moves) ?? puzzle.start));
  const movesRef = useRef(moves);
  const dragRef = useRef<{ v: number; x0: number; y0: number; lo: number; hi: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const reduce = useReducedMotion() || reducedMotion();
  const cell = useCellSize(n, GAP, PAD * 2 + EXIT_PAD, 60);
  const pitch = cell + GAP;
  const pos = replay(puzzle, moves) ?? puzzle.start;
  const occ = occupancy(puzzle, pos);
  const locked = !!disabled || done;

  const commit = useCallback(
    (m: Move) => {
      if (locked) return;
      const before = replay(puzzle, movesRef.current) ?? puzzle.start;
      const [lo, hi] = room(puzzle, before, m[0]);
      const v = puzzle.vehicles[m[0]];
      const name = vehicleName(puzzle, m[0]);
      if (m[1] < lo || m[1] > hi || !m[1]) {
        api.feedback(T.blocked(name, directionOf(v, m[1] || 1)), "info", "prohibit");
        return;
      }
      const next = pushMove(movesRef.current, m);
      movesRef.current = next;
      setMoves(next);
      const after = replay(puzzle, next) ?? puzzle.start;
      const state = { moves: next };
      const count = next.length;
      if (isSolved(after)) {
        setDone(true);
        setSel(-1);
        play("jingle");
        api.feedback(T.out(count, puzzle.par), "success", "check-circle");
        api.announce(T.cleared(count, puzzle.par));
      } else {
        play("pop", { step: Math.min(count, 12) });
        api.feedback(T.tally(count, puzzle.par), "info", "steering-wheel");
        api.announce(`${T.moved(name, directionOf(v, m[1]), Math.abs(m[1]))} ${T.tally(count, puzzle.par)}`);
      }
      api.onMove(state, { correctStreak: count });
      if (isSolved(after)) api.onSolved(state);
    },
    [api, locked, puzzle],
  );

  const select = useCallback(
    (v: number) => {
      if (locked) return;
      const next = v === sel ? -1 : v;
      setSel(next);
      if (next >= 0) api.announce(T.selected(vehicleName(puzzle, next)));
    },
    [api, locked, puzzle, sel],
  );

  const step = useCallback(
    (dir: Dir) => {
      if (locked) return;
      if (sel < 0) {
        api.feedback(T.noSelection, "info", "hand-tap");
        return;
      }
      const v = puzzle.vehicles[sel];
      const spec = DIRS.find((d) => d.dir === dir)!;
      if (spec.axis !== v.axis) {
        api.feedback(T.wrongAxis(vehicleName(puzzle, sel), v.axis), "info", "prohibit");
        return;
      }
      commit([sel, spec.step]);
    },
    [api, commit, locked, puzzle, sel],
  );

  /** Tap on a cell: select the vehicle there, or slide the selected one along its lane to this cell. */
  const tapCell = useCallback(
    (i: number) => {
      if (locked) return;
      if (occ[i] >= 0) return select(occ[i]);
      if (sel < 0) return api.feedback(T.noSelection, "info", "hand-tap");
      const v = puzzle.vehicles[sel];
      const r = Math.floor(i / n),
        c = i % n;
      const along = v.axis === "h" ? (r === v.line ? c : -1) : c === v.line ? r : -1;
      if (along < 0) return api.feedback(T.wrongAxis(vehicleName(puzzle, sel), v.axis), "info", "prohibit");
      const at = pos[sel];
      commit([sel, along < at ? along - at : along - (at + v.len - 1)]);
    },
    [api, commit, locked, n, occ, pos, puzzle, sel, select],
  );

  const undo = useCallback(() => {
    if (!movesRef.current.length || done) return;
    const next = movesRef.current.slice(0, -1);
    movesRef.current = next;
    setMoves(next);
    api.onMove({ moves: next });
    api.feedback(T.tally(next.length, puzzle.par), "info", "steering-wheel");
  }, [api, done, puzzle.par]);

  const reset = useCallback(() => {
    if (!movesRef.current.length || done) return;
    movesRef.current = [];
    setMoves([]);
    setSel(-1);
    api.onMove({ moves: [] });
    api.feedback(T.reset(puzzle.par), "info", "arrows-clockwise");
  }, [api, done, puzzle.par]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: T.controls.undo, icon: "arrow-counter-clockwise", onPress: undo, disabled: !moves.length || done },
      { id: "reset", label: T.controls.reset, icon: "arrows-clockwise", onPress: reset, disabled: !moves.length || done },
      { id: "hint", label: T.controls.hint, icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, reset, moves.length, done]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? T.tutorial : T.start(puzzle.par), "info", "steering-wheel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, tapCell);
  const onKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_DIR[e.key];
    if (sel >= 0 && dir) {
      e.preventDefault();
      const v = puzzle.vehicles[sel];
      const spec = DIRS.find((d) => d.dir === dir)!;
      if (spec.axis !== v.axis) return step(dir);
      step(dir);
      // Keep the focus on the vehicle as it moves.
      const [lo, hi] = room(puzzle, pos, sel);
      if (spec.step < lo || spec.step > hi) return;
      const r = Math.floor(keys.focus / n),
        c = keys.focus % n;
      const next = v.axis === "h" ? r * n + c + spec.step : (r + spec.step) * n + c;
      if (next >= 0 && next < n * n) {
        keys.setFocus(next);
        (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-i="${next}"]`)?.focus();
      }
      return;
    }
    if (e.key === "Escape" && sel >= 0) {
      e.preventDefault();
      setSel(-1);
      return;
    }
    keys.onKeyDown(e);
  };

  /* ---- Drag along the lane ---- */
  const cellAt = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    return el ? Number(el.dataset.i) : -1;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    const i = cellAt(e);
    const v = i >= 0 ? occ[i] : -1;
    if (v < 0) return;
    const [lo, hi] = room(puzzle, pos, v, occ);
    dragRef.current = { v, x0: e.clientX, y0: e.clientY, lo, hi, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const along = puzzle.vehicles[d.v].axis === "h" ? e.clientX - d.x0 : e.clientY - d.y0;
    if (!d.moved && Math.abs(along) < DRAG_START) return;
    if (!d.moved) {
      d.moved = true;
      // Capture only once it is a drag, so a plain tap still clicks the cell under it.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setSel(d.v);
    }
    setDrag({ v: d.v, px: Math.max(d.lo * pitch, Math.min(d.hi * pitch, along)) });
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancel = false) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    const px = drag?.v === d.v ? drag.px : 0;
    setDrag(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const steps = Math.round(px / pitch);
    if (!cancel && steps) commit([d.v, steps]);
  };

  const hintTarget = hint?.target as { vehicle?: number; delta?: number } | undefined;
  const hintV = typeof hintTarget?.vehicle === "number" && !done ? hintTarget.vehicle : -1;
  const selV = sel >= 0 ? puzzle.vehicles[sel] : null;
  const selRoom = sel >= 0 ? room(puzzle, pos, sel, occ) : ([0, 0] as [number, number]);
  const boardW = n * cell + (n - 1) * GAP;
  const exitTop = PAD + puzzle.exitRow * pitch;

  return (
    <div className={`flex w-full flex-col items-center gap-3 ${done ? "board-pulse" : ""}`}>
      <div className="relative" style={{ paddingRight: EXIT_PAD }}>
        <div
          role="grid"
          aria-label={T.board(puzzle.par)}
          aria-rowcount={n}
          aria-colcount={n}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)}
          onPointerCancel={(e) => endDrag(e, true)}
          className="relative grid rounded-[16px]"
          style={{
            gridTemplateColumns: `repeat(${n}, ${cell}px)`,
            gap: GAP,
            padding: PAD,
            background: "var(--board-bg)",
            boxShadow: "0 0 0 2px var(--line)",
          }}
        >
          {Array.from({ length: n }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c;
                const v = occ[i];
                const what =
                  v >= 0
                    ? T.cellVehicle(vehicleName(puzzle, v), puzzle.vehicles[v].axis, v === sel)
                    : r === puzzle.exitRow && c > (pos[0] ?? 0)
                      ? T.cellExit
                      : T.cellEmpty;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-label={T.cellLabel(r, c, what)}
                    aria-selected={v >= 0 && v === sel}
                    onFocus={() => keys.setFocus(i)}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      keys.setFocus(i);
                      tapCell(i);
                    }}
                    className="cursor-pointer rounded-[10px] outline-none focus-visible:z-10"
                    style={{
                      width: cell,
                      height: cell,
                      background: r === puzzle.exitRow ? "color-mix(in srgb, var(--world) 14%, var(--surface))" : "var(--surface)",
                      touchAction: v >= 0 ? "none" : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
          {/* Vehicles: drawn over the cells, never hit-tested (taps land on the cells beneath). */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[16px]">
            {puzzle.vehicles.map((v, i) => {
              const at = pos[i];
              const isTrotro = i === 0;
              const dragging = drag?.v === i;
              const shift = dragging ? drag.px : 0;
              const out = isTrotro && done && at === EXIT_COL;
              const x = PAD + (v.axis === "h" ? at : v.line) * pitch + (v.axis === "h" ? shift : 0);
              const y = PAD + (v.axis === "h" ? v.line : at) * pitch + (v.axis === "v" ? shift : 0);
              const w = v.axis === "h" ? v.len * cell + (v.len - 1) * GAP : cell;
              const h = v.axis === "v" ? v.len * cell + (v.len - 1) * GAP : cell;
              const chosen = i === sel;
              const hinted = i === hintV;
              return (
                <div
                  key={i}
                  data-vehicle={i}
                  className={`font-display absolute flex items-center justify-center rounded-[12px] font-black ${hinted ? "hint-ring" : ""}`}
                  style={{
                    left: 0,
                    top: 0,
                    width: w,
                    height: h,
                    transform: `translate(${x + (out && !reduce ? 2 * pitch + EXIT_PAD : 0)}px, ${y}px)`,
                    opacity: out && reduce ? 0.35 : 1,
                    background: isTrotro ? "var(--world)" : `var(--reg-${T.colourIndex(i)})`,
                    color: isTrotro ? "var(--square-ink)" : "var(--text)",
                    fontSize: Math.round(cell * 0.4),
                    boxShadow: chosen
                      ? "0 0 0 3px var(--accent), var(--shadow-toy)"
                      : hinted
                        ? "0 0 0 3px var(--gold)"
                        : "inset 0 -4px 0 color-mix(in srgb, var(--square-ink) 30%, transparent)",
                    transition: dragging || reduce ? "none" : `transform ${out ? 600 : 140}ms var(--ease-out)`,
                    zIndex: chosen || dragging ? 2 : 1,
                  }}
                >
                  {isTrotro ? <Icon name="bus" size={Math.round(cell * 0.55)} /> : T.letter(i)}
                  {v.len === 3 && !isTrotro && (
                    <span
                      className="absolute rounded-full"
                      style={
                        v.axis === "h"
                          ? { left: 8, top: 8, bottom: 8, width: 4, background: "currentColor", opacity: 0.4 }
                          : { left: 8, right: 8, top: 8, height: 4, background: "currentColor", opacity: 0.4 }
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Exit mark on the right edge of the exit row. */}
        <div
          aria-hidden
          className="absolute right-0 flex items-center justify-center text-[var(--world)]"
          style={{ top: exitTop, height: cell, width: EXIT_PAD + 2 }}
        >
          <Icon name="caret-right" size={EXIT_PAD + 4} />
        </div>
      </div>
      <div className="flex items-center gap-2" style={{ width: Math.min(boardW + PAD * 2, 360) }} role="group" aria-label={T.moveGroup}>
        {DIRS.map(({ dir, icon, axis, step: s }) => {
          const can = !!selV && selV.axis === axis && (s < 0 ? selRoom[0] < 0 : selRoom[1] > 0) && !locked;
          return (
            <button
              key={dir}
              type="button"
              aria-label={T.moveLabel(dir)}
              disabled={!can}
              onClick={() => step(dir)}
              className="flex h-11 min-w-11 flex-1 items-center justify-center rounded-[var(--r-control)] text-[var(--text)] disabled:opacity-40"
              style={{ background: "var(--surface-raised)", boxShadow: "0 0 0 1px var(--line)" }}
            >
              <Icon name={icon} size={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
