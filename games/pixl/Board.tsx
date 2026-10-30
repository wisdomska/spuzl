"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { analyze, CROSS, EMPTY, FILL, type PixlPuzzle, type PixlState } from "./logic";

type Tool = "fill" | "x";
const GAP = 2;
const PAD = 6;
const CLUE_PX = 15;
const LONG_PRESS_MS = 420;

const markName = (v: number) => (v === FILL ? "filled" : v === CROSS ? "marked X" : "empty");

/** Fits the grid plus clue gutters into the phone width. Below 22 px the board pans instead. */
function useFit(p: PixlPuzzle, clueW: number) {
  const [vw, setVw] = useState(390);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const avail = Math.min(vw, 460) - 36 - clueW - PAD * 2 - GAP * (p.w - 1);
  return Math.max(22, Math.min(48, Math.floor(avail / p.w)));
}

/**
 * Pixl board (nonogram). Tap fills, long-press or the X tool marks a cell empty, and a drag paints
 * the first cell's new mark across every cell it passes. Lines whose runs match their clue dim their
 * clue numbers; an over-full line hatches its cells. The clear wave paints the picture in world colour.
 */
export default function PixlBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<PixlPuzzle, PixlState>) {
  const { w, h } = puzzle;
  const [cells, setCells] = useState<PixlState>(() => initialState?.slice() ?? new Array(w * h).fill(EMPTY));
  const [hist, setHist] = useState<PixlState[]>([]);
  const [tool, setTool] = useState<Tool>("fill");
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const cellsRef = useRef(cells);
  const streak = useRef(0);
  const stroke = useRef<null | { start: number; value: number | null; moved: boolean; before: PixlState; timer: ReturnType<typeof setTimeout> | null; broke: boolean }>(null);
  const maxRow = Math.max(1, ...puzzle.rows.map((r) => Math.max(1, r.length)));
  const maxCol = Math.max(1, ...puzzle.cols.map((c) => Math.max(1, c.length)));
  const clueW = maxRow * CLUE_PX + 10;
  const clueH = maxCol * (CLUE_PX + 2) + 8;
  const cell = useFit(puzzle, clueW);
  const a = analyze(puzzle, cells);
  const locked = disabled || done;

  /** Writes one cell inside the current stroke (no history entry). */
  const write = useCallback(
    (i: number, value: number) => {
      const prev = cellsRef.current;
      if (prev[i] === value) return;
      const next = prev.slice();
      next[i] = value;
      cellsRef.current = next;
      setCells(next);
      setLast(i);
      setTapN((t) => t + 1);
      const before = analyze(puzzle, prev);
      const after = analyze(puzzle, next);
      const where = `Row ${Math.floor(i / w) + 1}, column ${(i % w) + 1}, ${markName(value)}`;
      const broke = after.bad.has(i) && after.bad.size > before.bad.size;
      if (broke) {
        streak.current = 0;
        setShakeN((k) => k + 1);
        if (stroke.current && !stroke.current.broke) {
          stroke.current.broke = true;
          api.ruleBreak(after.message);
        }
        api.announce(`${where}. ${after.message}`);
      } else {
        if (value === FILL) streak.current++;
        play(value === FILL ? "pop" : "tick", { step: streak.current });
        api.announce(where);
      }
      if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback("The picture is complete. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else if (!broke && after.bad.size === 0) {
        api.feedback(`${after.done.size} of ${w + h} lines match`, "info", "checkerboard");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, h, puzzle, w],
  );

  const toggleValue = (cur: number, mark: Tool) => (mark === "fill" ? (cur === FILL ? EMPTY : FILL) : cur === CROSS ? EMPTY : CROSS);

  const beginStroke = (i: number) => {
    stroke.current = { start: i, value: null, moved: false, before: cellsRef.current, timer: null, broke: false };
  };
  const endStroke = useCallback(() => {
    const s = stroke.current;
    if (!s) return;
    if (s.timer) clearTimeout(s.timer);
    stroke.current = null;
    if (cellsRef.current !== s.before) setHist((hh) => [...hh, s.before]);
  }, []);

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    if (locked) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    beginStroke(i);
    const s = stroke.current!;
    // Long-press marks X whatever the tool, then a drag keeps painting X.
    s.timer = setTimeout(() => {
      if (!stroke.current || stroke.current.moved) return;
      stroke.current.value = toggleValue(cellsRef.current[i], "x");
      stroke.current.timer = null;
      write(i, stroke.current.value);
    }, LONG_PRESS_MS);
  };
  const onPointerEnter = (i: number) => () => {
    const s = stroke.current;
    if (!s || locked || i === s.start && !s.moved) return;
    if (s.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
    if (s.value === null) {
      s.value = toggleValue(cellsRef.current[s.start], tool);
      write(s.start, s.value);
    }
    s.moved = true;
    // Painting never overwrites the other kind of mark; erasing only clears the same kind.
    const cur = cellsRef.current[i];
    const ok = s.value === EMPTY ? cur === cellsRef.current[s.start] || cur === s.before[s.start] : cur === EMPTY;
    if (ok) write(i, s.value);
  };
  const onPointerUp = (i: number) => () => {
    const s = stroke.current;
    if (!s || locked) return;
    if (s.value === null && s.start === i) write(i, toggleValue(cellsRef.current[i], tool));
    endStroke();
  };
  useEffect(() => {
    const up = () => endStroke();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [endStroke]);

  const undo = useCallback(() => {
    setHist((hh) => {
      if (!hh.length) return hh;
      const prev = hh[hh.length - 1];
      cellsRef.current = prev;
      setCells(prev);
      api.onMove(prev);
      return hh.slice(0, -1);
    });
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "fill", label: "Fill", icon: "paint-brush", onPress: () => setTool("fill"), active: tool === "fill" },
      { id: "x", label: "Mark X", icon: "x", onPress: () => setTool((t) => (t === "x" ? "fill" : "x")), active: tool === "x" },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done, tool]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? "Tap to fill. Hold to mark X. Drag to paint." : "Tap fills, hold marks X, drag paints.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: Space cycles empty, filled, X. Enter toggles the current tool's mark.
  const keys = useGridKeys(
    h,
    w,
    (i) => {
      if (locked) return;
      beginStroke(i);
      write(i, (cellsRef.current[i] + 1) % 3);
      endStroke();
    },
    (i) => {
      if (locked) return;
      beginStroke(i);
      write(i, toggleValue(cellsRef.current[i], tool));
      endStroke();
    },
  );

  const lastR = Math.floor(last / w), lastC = last % w;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const step = cell + GAP;
  const gridW = w * cell + (w - 1) * GAP + PAD * 2;
  const gridH = h * cell + (h - 1) * GAP + PAD * 2;
  const clueColor = (doneLine: boolean) => (doneLine ? "color-mix(in srgb, var(--text-muted) 45%, transparent)" : "var(--text)");

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "100%" }}>
      <div className="grid" style={{ gridTemplateColumns: `${clueW}px ${gridW}px`, gridTemplateRows: `${clueH}px ${gridH}px` }}>
        <div aria-hidden />
        {/* Column clues */}
        <div aria-hidden className="relative" style={{ paddingLeft: PAD }}>
          {puzzle.cols.map((clue, c) => {
            const dl = a.done.has(h + c);
            return (
              <div
                key={c}
                className="num absolute bottom-1 flex flex-col items-center justify-end font-semibold"
                style={{ left: PAD + c * step, width: cell, fontSize: 13, lineHeight: `${CLUE_PX + 2}px`, color: clueColor(dl), textDecoration: dl ? "line-through" : undefined }}
              >
                {(clue.length ? clue : [0]).map((n, k) => (
                  <span key={k}>{n}</span>
                ))}
              </div>
            );
          })}
        </div>
        {/* Row clues */}
        <div aria-hidden className="relative">
          {puzzle.rows.map((clue, r) => {
            const dl = a.done.has(r);
            return (
              <div
                key={r}
                className="num absolute right-2 flex items-center justify-end gap-[5px] font-semibold"
                style={{ top: PAD + r * step, height: cell, fontSize: 13, color: clueColor(dl), textDecoration: dl ? "line-through" : undefined }}
              >
                {(clue.length ? clue : [0]).map((n, k) => (
                  <span key={k}>{n}</span>
                ))}
              </div>
            );
          })}
        </div>
        <div
          role="grid"
          aria-label={`Pixl board, ${w} by ${h}`}
          aria-rowcount={h}
          aria-colcount={w}
          onKeyDown={keys.onKeyDown}
          className="relative grid touch-none rounded-[14px] select-none"
          style={{ gridTemplateColumns: `repeat(${w}, ${cell}px)`, gap: GAP, padding: PAD, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
        >
          {Array.from({ length: h }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: w }, (_, c) => {
                const i = r * w + c;
                const v = cells[i];
                const bad = a.bad.has(i);
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                let anim = "";
                if (!done && i === last) anim = bad ? shakeClass(shakeN) : popClass(tapN);
                const glow = i === hintTarget && !done;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-label={`Row ${r + 1}, column ${c + 1}, ${markName(v)}${bad ? ", breaks a clue" : ""}`}
                    aria-selected={v === FILL}
                    onFocus={() => keys.setFocus(i)}
                    onPointerDown={onPointerDown(i)}
                    onPointerEnter={onPointerEnter(i)}
                    onPointerUp={onPointerUp(i)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`relative flex cursor-pointer items-center justify-center rounded-[6px] outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      background: v === FILL ? "var(--world)" : "var(--surface-raised)",
                      color: bad ? "var(--danger)" : "var(--text-muted)",
                      boxShadow: glow ? "inset 0 0 0 3px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : undefined,
                    }}
                  >
                    {done && <span aria-hidden className="absolute inset-0" style={waveStyle(dist, v === FILL ? "var(--world)" : "var(--board-bg)", 6)} />}
                    {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[6px]" />}
                    {v === CROSS && !done && <Icon name="x" size={Math.round(cell * 0.45)} className="relative" />}
                  </div>
                );
              })}
            </div>
          ))}
          {/* Thicker guide every 5 cells */}
          {!done && Array.from({ length: Math.floor((w - 1) / 5) }, (_, k) => (
            <span key={`v${k}`} aria-hidden className="pointer-events-none absolute" style={{ left: PAD + (k + 1) * 5 * step - GAP, top: PAD, width: GAP, height: gridH - PAD * 2, background: "var(--text-muted)", opacity: 0.6 }} />
          ))}
          {!done && Array.from({ length: Math.floor((h - 1) / 5) }, (_, k) => (
            <span key={`h${k}`} aria-hidden className="pointer-events-none absolute" style={{ top: PAD + (k + 1) * 5 * step - GAP, left: PAD, height: GAP, width: gridW - PAD * 2, background: "var(--text-muted)", opacity: 0.6 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
