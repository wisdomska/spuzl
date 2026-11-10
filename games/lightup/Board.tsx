"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { fitCell, useViewportWidth } from "@/components/game/useBoardSize";
import { isKeyedInput, useGridKeys } from "@/components/game/useGridKeys";
import { sfx } from "@/games/_shared/sfx";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { reducedMotion } from "@/games/_shared/fly";
import { LIGHTUP_COPY as T } from "@/lib/copy/lightup";
import { analyze, BLACK, EMPTY, geometry, LAMP, MARK, WHITE, type LightUpPuzzle, type LightUpState } from "./logic";
import { centreOn, clampPan, panToShow, ZOOM_AT, ZOOM_CELL, type Pan, type ZoomGeo } from "./zoom";

/** A finger that moves this far (px) on the zoomed board is dragging it, not tapping a cell. */
const DRAG_PX = 8;

type Tool = "lamp" | "x";
/** Cell gap and board padding: 2 and 6 px, tightened to 1 and 3 px on 10 × 10 so its cells stay large on phones. */
const gapFor = (n: number) => (n >= 10 ? 1 : 2);
const padFor = (n: number) => (n >= 10 ? 3 : 6);
/** White cells sit clearly lighter than the board and the black cells in both themes; lit ones take a gold wash. */
const WHITE_FILL = "color-mix(in srgb, var(--text) 16%, var(--surface))";
const LIT_FILL = "color-mix(in srgb, var(--gold) 34%, var(--surface))";
/** Light travels: cells along a placed (or lifted) lamp's beams change this much later per step away, capped. */
const BEAM_STEP_MS = 18;
const BEAM_CAP_MS = 160;

/**
 * Light Up board. Tap a white cell: lamp, then X, then clear (or place the chosen tool's mark). Lit cells
 * glow and carry a light beam along the row or column it comes from, so lit never relies on colour alone.
 * Lamps that see each other and over-full numbers shake, ring red and hatch.
 *
 * R4-22 tap-to-zoom: when the cells come out under 44 px (10 × 10 on a phone), the first tap zooms the board in on
 * that spot (48 px cells inside the same frame, so nothing else on the screen moves) and places nothing. A drag moves
 * the zoomed board, keyboard focus and hints bring their cell into view, and the Zoom tool again (or a clear)
 * zooms back out. Keys place straight away, zoomed or not.
 */
export default function LightUpBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<LightUpPuzzle, LightUpState>) {
  const n = puzzle.size;
  const geo = geometry(puzzle);
  const [cells, setCells] = useState<LightUpState>(() =>
    initialState?.length === n * n ? initialState.slice() : new Array<number>(n * n).fill(EMPTY),
  );
  const [hist, setHist] = useState<LightUpState[]>([]);
  const [tool, setTool] = useState<Tool | null>(null);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const cellsRef = useRef(cells);
  const streak = useRef(0);
  const gap = gapFor(n);
  const pad = padFor(n);
  // 44 px cells where they fit; a 10 × 10 board may use the shell's board padding (36 px at 375 wide, 30 at 320).
  const fit = fitCell(useViewportWidth(), n, gap * (n - 1) + pad * 2, 44, 56);
  // Tap-to-zoom (R4-22): `pan` is null for the whole board, else how far the zoomed grid is moved (zoom.ts).
  const zoomable = fit < ZOOM_AT;
  const [pan, setPan] = useState<Pan | null>(null);
  const zoomed = zoomable && pan !== null && !done;
  const cell = zoomed ? ZOOM_CELL : fit;
  const zg: ZoomGeo = { n, cell: ZOOM_CELL, gap, pad, view: n * fit + (n - 1) * gap + pad * 2 };
  const drag = useRef<{ id: number; x: number; y: number; from: Pan; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [reduce] = useState(() => reducedMotion());
  const a = analyze(puzzle, cells);

  const commit = useCallback(
    (i: number, value: number) => {
      if (disabled || done || puzzle.grid[i] !== WHITE) return;
      const prev = cellsRef.current;
      if (prev[i] === value) return;
      const next = prev.slice();
      next[i] = value;
      cellsRef.current = next;
      const before = analyze(puzzle, prev);
      const after = analyze(puzzle, next);
      const broke = after.bad.size > before.bad.size;
      setCells(next);
      setHist((h) => [...h, prev]);
      setLast(i);
      setTapN((t) => t + 1);
      setQuiet(isKeyedInput());
      const r = Math.floor(i / n),
        c = i % n;
      const what =
        value === LAMP ? T.cellState.lamp : value === MARK ? T.cellState.mark : after.lit.has(i) ? T.cellState.lit : T.cellState.dark;
      if (broke) {
        streak.current = 0;
        setShakeN((s) => s + 1);
        const over = [...after.bad].find((b) => puzzle.grid[b] !== WHITE);
        const msg = over !== undefined && !before.bad.has(over) ? T.overfull(puzzle.grid[over]) : T.clash;
        api.ruleBreak(msg);
        api.announce(`${T.cellLabel(r, c, what)}. ${msg}`);
      } else if (after.clear) {
        setDone(true);
        sfx.place(streak.current + 1);
        api.feedback(T.cleared, "success", "check-circle");
        api.announce(T.cleared);
      } else {
        if (value === LAMP) streak.current++;
        if (value === EMPTY) sfx.remove();
        else sfx.place(Math.max(1, streak.current));
        api.announce(`${T.cellLabel(r, c, what)}. ${T.count(after.lit.size, after.whites)}.`);
        if (!after.bad.size) api.feedback(T.count(after.lit.size, after.whites), "info", "lightbulb-filament");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, disabled, done, n, puzzle],
  );

  const cycle = useCallback(
    (i: number) => {
      const v = cellsRef.current[i];
      const next = tool === "lamp" ? (v === LAMP ? EMPTY : LAMP) : tool === "x" ? (v === MARK ? EMPTY : MARK) : (v + 1) % 3;
      commit(i, next);
    },
    [commit, tool],
  );

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length || done) return h;
      const prev = h[h.length - 1];
      cellsRef.current = prev;
      setCells(prev);
      api.onMove(prev);
      return h.slice(0, -1);
    });
  }, [api, done]);

  const zoomTo = useCallback(
    (i: number) => {
      setPan(centreOn(Math.floor(i / n), i % n, zg));
      api.announce(T.zoom.zoomed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, n, zg.view, gap, pad],
  );
  const zoomOut = useCallback(() => {
    setPan(null);
    api.announce(T.zoom.whole);
  }, [api]);

  const keys = useGridKeys(n, n, cycle);

  // Zoomed: keyboard focus and a new hint's cell come into view (adjusted during render, no extra effect pass).
  const hintCell = typeof hint?.target === "number" ? hint.target : -1;
  const [seen, setSeen] = useState({ focus: keys.focus, hint: hintCell });
  if (seen.focus !== keys.focus || seen.hint !== hintCell) {
    setSeen({ focus: keys.focus, hint: hintCell });
    const t = seen.hint !== hintCell && hintCell >= 0 ? hintCell : keys.focus;
    if (zoomed && pan) setPan(panToShow(pan, Math.floor(t / n), t % n, zg));
  }
  // A board that stops being zoomable (a wider window) or is cleared shows whole.
  if (pan !== null && (!zoomable || done)) setPan(null);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: T.controls.undo, icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      ...(zoomable && !done
        ? [
            {
              id: "zoom",
              label: T.controls.zoom,
              icon: zoomed ? "magnifying-glass-minus" : "magnifying-glass-plus",
              onPress: () => (zoomed ? zoomOut() : zoomTo(keys.focus)),
              active: zoomed,
            },
          ]
        : []),
      {
        id: "lamp",
        label: T.controls.lamp,
        icon: "lightbulb-filament",
        onPress: () => setTool((t) => (t === "lamp" ? null : "lamp")),
        active: tool === "lamp",
      },
      { id: "x", label: T.controls.mark, icon: "x", onPress: () => setTool((t) => (t === "x" ? null : "x")), active: tool === "x" },
      { id: "hint", label: T.controls.hint, icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done, tool, zoomable, zoomed, zoomOut, zoomTo, keys.focus]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? T.tutorial : T.start(0), "info", "lightbulb-filament");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A tap on a cell: on the whole board of a zoomable game it zooms in there; otherwise `act` runs. */
  const tap = (i: number, act?: () => void) => {
    if (dragged.current) return; // the end of a drag, not a tap
    keys.setFocus(i);
    if (zoomable && !zoomed && !done) zoomTo(i);
    else act?.();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    dragged.current = false;
    if (!zoomed || !pan) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: pan, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!d.moved) {
      d.moved = true;
      dragged.current = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setPan(clampPan({ x: d.from.x - dx, y: d.from.y - dy }, zg));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  // Which way each lit cell's light comes from: a beam along the row (h) and/or the column (v).
  const beamH = new Set<number>();
  const beamV = new Set<number>();
  for (const i of geo.white)
    if (cells[i] === LAMP) for (const j of geo.see[i]) (Math.floor(j / n) === Math.floor(i / n) ? beamH : beamV).add(j);

  const lastR = Math.floor(last / n),
    lastC = last % n;
  const hintTarget = typeof hint?.target === "number" && !done ? hint.target : -1;

  return (
    <div className={`flex w-full flex-col items-center ${done ? "board-pulse" : ""}`}>
      {/* R4-22: a zoomable board keeps its whole-board frame; zoomed, the bigger grid moves inside it (clipped, not
          scrolled, so focusing a cell never scrolls it). */}
      <div
        data-zoom={zoomable ? (zoomed ? "in" : "out") : undefined}
        className="relative rounded-[16px]"
        style={{
          width: zoomable ? zg.view : undefined,
          height: zoomable ? zg.view : undefined,
          overflow: zoomable ? "clip" : undefined,
          background: "var(--board-bg)",
          boxShadow: "0 0 0 2px var(--line)",
          touchAction: zoomed ? "none" : undefined,
          cursor: zoomed ? "grab" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          role="grid"
          aria-label={T.board(n)}
          aria-rowcount={n}
          aria-colcount={n}
          onKeyDown={keys.onKeyDown}
          className="grid w-max rounded-[16px]"
          style={{
            gridTemplateColumns: `repeat(${n}, ${cell}px)`,
            gap,
            padding: pad,
            perspective: 600,
            transform: zoomed && pan ? `translate3d(${-pan.x}px, ${-pan.y}px, 0)` : undefined,
            transition: reduce || dragging ? undefined : "transform 180ms var(--ease-out)",
          }}
        >
          {Array.from({ length: n }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: n }, (_, c) => {
                const i = r * n + c;
                const g = puzzle.grid[i];
                const v = cells[i];
                const bad = a.bad.has(i);
                const glow = i === hintTarget;
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                const anim = done ? "" : i === last ? (bad ? shakeClass(shakeN) : quiet ? "" : popClass(tapN)) : "";
                if (g !== WHITE) {
                  const num = g === BLACK ? null : g;
                  const lampsAround = num === null ? 0 : geo.adj[i].filter((j) => cells[j] === LAMP).length;
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      data-i={i}
                      tabIndex={keys.focus === i ? 0 : -1}
                      aria-readonly
                      aria-label={T.cellLabel(
                        r,
                        c,
                        (num === null ? T.cellState.black : T.cellState.number(num)) + (bad ? T.cellState.bad : ""),
                      )}
                      onClick={() => tap(i)}
                      onFocus={() => keys.setFocus(i)}
                      className={`relative flex items-center justify-center rounded-[6px] font-sans font-black outline-none focus-visible:z-10 ${glow ? "hint-ring" : ""} ${bad && !done ? "hatch" : ""}`}
                      style={{
                        width: cell,
                        height: cell,
                        background: "var(--square-ink)",
                        color: bad ? "var(--danger)" : "var(--bay-disc-light)",
                        opacity: num !== null && lampsAround === num ? 0.55 : 1,
                        boxShadow: glow ? "inset 0 0 0 3px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : undefined,
                        fontSize: Math.round(cell * 0.5),
                      }}
                    >
                      {num}
                    </div>
                  );
                }
                const lit = a.lit.has(i);
                // The last lamp's beam reaches farther cells a little later (on and off alike).
                const beam = !quiet && !done && last >= 0 && geo.see[last]?.includes(i) ? Math.min(BEAM_CAP_MS, dist * BEAM_STEP_MS) : 0;
                const what =
                  v === LAMP
                    ? T.cellState.lamp
                    : v === MARK
                      ? `${T.cellState.mark}${lit ? `, ${T.cellState.lit}` : ""}`
                      : lit
                        ? T.cellState.lit
                        : T.cellState.dark;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-selected={v === LAMP}
                    aria-label={T.cellLabel(r, c, what + (bad ? T.cellState.bad : ""))}
                    onClick={() => tap(i, () => cycle(i))}
                    onFocus={() => keys.setFocus(i)}
                    className={`relative flex cursor-pointer items-center justify-center overflow-hidden rounded-[6px] outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      background: v === LAMP ? "var(--gold)" : lit ? LIT_FILL : WHITE_FILL,
                      color: v === LAMP ? "var(--on-gold)" : "var(--text-muted)",
                      boxShadow: glow ? "inset 0 0 0 3px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : undefined,
                      transition: "background-color 120ms var(--ease-out)",
                      transitionDelay: beam ? `${beam}ms` : undefined,
                    }}
                  >
                    {done && <span aria-hidden className="absolute inset-0" style={waveStyle(dist, "var(--gold)", 6)} />}
                    {v !== LAMP && beamH.has(i) && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2"
                        style={{ background: "var(--gold)", opacity: 0.7 }}
                      />
                    )}
                    {v !== LAMP && beamV.has(i) && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2"
                        style={{ background: "var(--gold)", opacity: 0.7 }}
                      />
                    )}
                    {bad && !done && <span aria-hidden className="hatch absolute inset-0" />}
                    {v === LAMP && <Icon name="lightbulb-filament" size={Math.round(cell * 0.6)} className="relative" />}
                    {v === MARK && !done && (
                      <span
                        className="relative flex items-center justify-center rounded-full"
                        style={{ background: lit ? LIT_FILL : WHITE_FILL }}
                      >
                        <Icon name="x" size={Math.round(cell * 0.4)} />
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
