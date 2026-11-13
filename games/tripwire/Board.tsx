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
import { reducedMotion } from "@/games/_shared/fly";
import { centreOn, clampPan, panToShow, type Pan, type ZoomGeo } from "@/games/_shared/zoom";
import { TRIPWIRE_COPY as T } from "@/lib/copy/tripwire";
import { field, FLAG, flood, HIDDEN, neighbours, OPEN, TRIPPED, type TripwirePuzzle, type TripwireState } from "./logic";

const GAP = 3;
const PAD = 6;
/** Smallest tile tapped straight away (the whole tile is the tap target). Smaller tiles zoom on the first tap. */
const MIN_CELL = 32;
/** How small the whole-board overview may get (the mega board on a 320 x 568 phone) before it would scroll. */
const MIN_OVERVIEW = 16;
/** Tile size (px) in the zoomed view: a full touch target. */
const ZOOM_TILE = 44;
/** A finger that moves this far (px) on the zoomed board is dragging it, not tapping a tile. */
const DRAG_PX = 8;
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
  const fitted = useFitHeight(ideal, Math.min(MIN_OVERVIEW, ideal), h, root, "shell");
  const locked = disabled || done;
  // Tap-to-zoom (like Light Up): tiles that fit under MIN_CELL px show the whole board, and the first tap zooms in
  // there (ZOOM_TILE px tiles inside the same frame, so nothing else on the screen moves) and reveals nothing. A drag
  // moves the zoomed board, keyboard focus and hints bring their tile into view, and the Zoom tool zooms back out.
  const zoomable = fitted < MIN_CELL;
  const [pan, setPan] = useState<Pan | null>(null);
  const zoomed = zoomable && pan !== null && !done;
  const cell = zoomed ? ZOOM_TILE : fitted;
  const zg: ZoomGeo = {
    n: w,
    rows: h,
    cell: ZOOM_TILE,
    gap: GAP,
    pad: PAD,
    view: w * fitted + (w - 1) * GAP + PAD * 2,
    viewH: h * fitted + (h - 1) * GAP + PAD * 2,
  };
  const drag = useRef<{ id: number; x: number; y: number; from: Pan; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [reduce] = useState(() => reducedMotion());
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

  const zoomTo = useCallback(
    (i: number) => {
      setPan(centreOn(Math.floor(i / w), i % w, zg));
      api.announce(T.zoom.zoomed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, w, h, zg.view, zg.viewH],
  );
  const zoomOut = useCallback(() => {
    setPan(null);
    api.announce(T.zoom.whole);
  }, [api]);

  // Keyboard: Space flags, Enter reveals (zoomed or not).
  const keys = useGridKeys(h, w, toggleFlag, reveal);

  // Zoomed: keyboard focus and a new hint's tile come into view (adjusted during render, no extra effect pass).
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const [seen, setSeen] = useState({ focus: keys.focus, hint: hintTarget });
  if (seen.focus !== keys.focus || seen.hint !== hintTarget) {
    setSeen({ focus: keys.focus, hint: hintTarget });
    const t = seen.hint !== hintTarget && hintTarget >= 0 ? hintTarget : keys.focus;
    if (zoomed && pan) setPan(panToShow(pan, Math.floor(t / w), t % w, zg));
  }
  // A board that stops being zoomable (a bigger window) or is cleared shows whole.
  if (pan !== null && (!zoomable || done)) setPan(null);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      ...(zoomable && !done
        ? [
            {
              id: "zoom",
              label: T.zoomLabel,
              icon: zoomed ? "magnifying-glass-minus" : "magnifying-glass-plus",
              onPress: () => (zoomed ? zoomOut() : zoomTo(keys.focus)),
              active: zoomed,
            },
          ]
        : []),
      { id: "flag", label: "Flag", icon: "flag", onPress: () => setFlagTool((t) => !t), active: flagTool },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done, flagTool, zoomable, zoomed, zoomOut, zoomTo, keys.focus]);

  // The opening line; a board that zooms says so until the first tile is open.
  useEffect(() => {
    if (cellsRef.current.includes(OPEN)) return;
    api.feedback(
      mode === "tutorial"
        ? "Tap anywhere to start. The first tap is always safe."
        : zoomable
          ? T.zoom.start
          : "Tap to reveal, hold to flag. First tap is safe.",
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomable]);

  // Long-press flags; a short tap acts with the current tool. On the whole board of a zoomable game, a tap zooms in.
  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    if (locked) return;
    const zoomFirst = zoomable && !zoomed;
    // The zoom changes what lies under the finger: no mouse events after it (they would focus another tile).
    if (zoomFirst) e.preventDefault();
    press.current = {
      i,
      fired: false,
      timer: zoomFirst
        ? null
        : setTimeout(() => {
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
    if (!tap || p.fired || p.i !== i || dragged.current) return;
    keys.setFocus(i);
    if (zoomable && !zoomed) zoomTo(i);
    else act(i);
  };

  // Dragging the zoomed board (the frame); a drag is never a tap or a long press.
  const onFrameDown = (e: React.PointerEvent) => {
    dragged.current = false;
    if (!zoomed || !pan) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: pan, moved: false };
  };
  const onFrameMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!d.moved) {
      d.moved = true;
      dragged.current = true;
      if (press.current?.timer) clearTimeout(press.current.timer);
      press.current = null;
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
  const lastR = Math.floor(last / w),
    lastC = last % w;

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
      {/* A zoomable board keeps its whole-board frame; zoomed, the bigger grid moves inside it (clipped, not scrolled,
          so focusing a tile never scrolls it). */}
      <div
        data-zoom={zoomable ? (zoomed ? "in" : "out") : undefined}
        className={zoomable ? "relative rounded-[16px]" : "overflow-x-auto"}
        style={
          zoomable
            ? {
                width: zg.view,
                height: zg.viewH,
                overflow: "clip",
                background: "var(--board-bg)",
                boxShadow: "0 0 0 2px var(--line)",
                touchAction: zoomed ? "none" : undefined,
                cursor: zoomed ? "grab" : undefined,
              }
            : { maxWidth: "100%" }
        }
        onPointerDown={onFrameDown}
        onPointerMove={onFrameMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          role="grid"
          aria-label={`Tripwire board, ${w} by ${h}, ${puzzle.mines.length} mines`}
          aria-rowcount={h}
          aria-colcount={w}
          onKeyDown={keys.onKeyDown}
          className="grid w-max rounded-[16px] select-none"
          style={{
            gridTemplateColumns: `repeat(${w}, ${cell}px)`,
            gap: GAP,
            padding: PAD,
            background: zoomable ? undefined : "var(--board-bg)",
            boxShadow: zoomable ? undefined : "0 0 0 2px var(--line)",
            perspective: 600,
            transform: zoomed && pan ? `translate3d(${-pan.x}px, ${-pan.y}px, 0)` : undefined,
            transition: reduce || dragging ? undefined : "transform 180ms var(--ease-out)",
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
                    className={`num relative flex cursor-pointer items-center justify-center font-semibold outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: Math.min(10, Math.round(cell / 4)),
                      // the count grows with the cell (big on a wide screen), never under 16 px (a little less on the
                      // small whole-board view of a zoomable board, which is for looking, not tapping)
                      fontSize: Math.max(Math.min(16, cell - 6), Math.round(cell * 0.46)),
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
                    {trip && <span aria-hidden className="hatch absolute inset-0 rounded-[inherit]" />}
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
