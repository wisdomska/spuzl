"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { analyze, area, inRect, rectBreak, sameRect, spanRect, type QuiltPuzzle, type QuiltState, type Rect } from "./logic";

const PAD = 6;
/** Rectangle fills (design: five orange shades). Mixed from the world colour so themes and colour-blind modes follow. */
const SHADES = [
  "var(--world)",
  "color-mix(in srgb, var(--world) 86%, #000)",
  "color-mix(in srgb, var(--world) 74%, #fff)",
  "color-mix(in srgb, var(--world) 76%, #000)",
  "color-mix(in srgb, var(--world) 58%, #fff)",
];
const INK = "#0E0F1A";

/** Neighbouring rectangles never share a shade (greedy colouring in placement order). */
function shadeOf(rects: Rect[]): number[] {
  const out: number[] = [];
  rects.forEach((r, k) => {
    const taken = new Set<number>();
    for (let j = 0; j < k; j++) {
      const o = rects[j];
      const touch = r[0] <= o[0] + o[2] && o[0] <= r[0] + r[2] && r[1] <= o[1] + o[3] && o[1] <= r[1] + r[3];
      if (touch) taken.add(out[j]);
    }
    let s = 0;
    while (taken.has(s) && s < SHADES.length - 1) s++;
    out.push(s);
  });
  return out;
}

/**
 * Quilt board (Game Boards: Quilt). Drag from one corner to the other to draw a rectangle; the area
 * counter rides the finger. Tap a rectangle to remove it. Keyboard: Space sets a corner, Space again
 * draws, Delete removes the rectangle under focus.
 */
export default function QuiltBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<QuiltPuzzle, QuiltState>) {
  const { rows, cols } = puzzle;
  const [rects, setRects] = useState<QuiltState>(() => initialState?.map((r) => [...r] as Rect) ?? []);
  const [hist, setHist] = useState<QuiltState[]>([]);
  const [drag, setDrag] = useState<null | { a: number; b: number; x: number; y: number; moved: boolean }>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [last, setLast] = useState<{ rect: Rect; n: number; bad: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const rectsRef = useRef(rects);
  const gridRef = useRef<HTMLDivElement>(null);
  const cell = useCellSize(cols, 0, PAD * 2, 56);
  const a = analyze(puzzle, rects);
  const shades = useMemo(() => shadeOf(rects), [rects]);
  const clueAt = useMemo(() => new Map(puzzle.clues), [puzzle.clues]);
  const total = puzzle.clues.length;

  const report = useCallback(
    (next: QuiltState, placed: Rect | null, prev: QuiltState) => {
      rectsRef.current = next;
      setRects(next);
      setHist((h) => [...h, prev]);
      const after = analyze(puzzle, next);
      if (!placed) {
        play("tick");
        api.announce(`Rectangle removed. ${next.length} of ${total} rectangles.`);
        api.feedback(`${next.length} of ${total} rectangles`, "info", "layout");
        api.onMove(next, { correctStreak: streak.current });
        return;
      }
      const why = rectBreak(puzzle, placed);
      const where = `Rows ${placed[0] + 1} to ${placed[0] + placed[2]}, columns ${placed[1] + 1} to ${placed[1] + placed[3]}, area ${area(placed)}`;
      setLast((l) => ({ rect: placed, n: (l?.n ?? 0) + 1, bad: !!why }));
      if (why) {
        streak.current = 0;
        const msg = after.message;
        api.ruleBreak(msg);
        api.announce(`${where}. ${msg}`);
      } else if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback("Stitched. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else {
        streak.current++;
        play("pop", { step: streak.current });
        api.announce(`${where}, rectangle placed.`);
        const tip = mode === "tutorial" && next.length === 1 ? "Nice. Each number gets its own rectangle." : null;
        api.feedback(tip ?? `${next.length} of ${total} rectangles`, "info", tip ? "hand-pointing" : "layout");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: !!why });
      if (after.clear) api.onSolved(next);
    },
    [api, mode, puzzle, total],
  );

  const place = useCallback(
    (r: Rect) => {
      if (disabled || done) return;
      const prev = rectsRef.current;
      const overlapsNew = (o: Rect) => o[0] < r[0] + r[2] && r[0] < o[0] + o[2] && o[1] < r[1] + r[3] && r[1] < o[1] + o[3];
      if (prev.some((o) => sameRect(o, r))) return;
      report([...prev.filter((o) => !overlapsNew(o)), r], r, prev);
    },
    [disabled, done, report],
  );

  const removeAt = useCallback(
    (i: number) => {
      if (disabled || done) return false;
      const prev = rectsRef.current;
      const y = Math.floor(i / cols), x = i % cols;
      const k = prev.findIndex((r) => inRect(r, y, x));
      if (k < 0) return false;
      report(prev.filter((_, j) => j !== k), null, prev);
      return true;
    },
    [cols, disabled, done, report],
  );

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      rectsRef.current = prev;
      setRects(prev);
      api.onMove(prev);
      play("tick");
      return h.slice(0, -1);
    });
  }, [api]);

  const clearAll = useCallback(() => {
    const prev = rectsRef.current;
    if (!prev.length || done) return;
    rectsRef.current = [];
    setRects([]);
    setHist((h) => [...h, prev]);
    play("tick");
    api.onMove([]);
    api.feedback(`0 of ${total} rectangles`, "info", "layout");
    api.announce("Board cleared of rectangles.");
  }, [api, done, total]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "clear", label: "Clear", icon: "eraser", onPress: clearAll, disabled: !rects.length || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, clearAll, hist.length, rects.length, done]);

  useEffect(() => {
    if (mode === "tutorial") api.feedback("Drag from corner to corner. The number is the area.", "info", "hand-pointing");
    else api.feedback(`0 of ${total} rectangles`, "info", "layout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- keyboard ---------- */
  const onSpace = useCallback(
    (i: number) => {
      if (disabled || done) return;
      if (anchor === null) {
        setAnchor(i);
        play("tick");
        api.announce(`Corner set at row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}. Move, then press Space to draw.`);
      } else {
        place(spanRect(cols, anchor, i));
        setAnchor(null);
      }
    },
    [anchor, api, cols, disabled, done, place],
  );
  const keys = useGridKeys(rows, cols, onSpace);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeAt(keys.focus);
      return;
    }
    if (e.key === "Escape" && anchor !== null) {
      setAnchor(null);
      return;
    }
    keys.onKeyDown(e);
  };

  /* ---------- pointer ---------- */
  const cellAt = (e: PointerEvent) => {
    const el = gridRef.current!;
    const box = el.getBoundingClientRect();
    const x = Math.min(cols - 1, Math.max(0, Math.floor((e.clientX - box.left - PAD) / cell)));
    const y = Math.min(rows - 1, Math.max(0, Math.floor((e.clientY - box.top - PAD) / cell)));
    return { i: y * cols + x, px: e.clientX - box.left, py: e.clientY - box.top };
  };
  const onPointerDown = (e: PointerEvent) => {
    if (disabled || done || e.button > 0) return;
    const { i, px, py } = cellAt(e);
    gridRef.current?.setPointerCapture(e.pointerId);
    keys.setFocus(i);
    setAnchor(null);
    setDrag({ a: i, b: i, x: px, y: py, moved: false });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const { i, px, py } = cellAt(e);
    if (i !== drag.b || px !== drag.x || py !== drag.y) setDrag({ ...drag, b: i, x: px, y: py, moved: drag.moved || i !== drag.a });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      if (removeAt(d.a)) return;
      if (clueAt.get(d.a) === 1) place(spanRect(cols, d.a, d.a));
      else api.feedback("Drag from corner to corner to draw a rectangle.", "info", "hand-pointing");
      return;
    }
    place(spanRect(cols, d.a, d.b));
  };

  /* ---------- render ---------- */
  const preview: Rect | null = drag?.moved ? spanRect(cols, drag.a, drag.b) : anchor !== null ? spanRect(cols, anchor, keys.focus) : null;
  const previewBreak = preview ? rectBreak(puzzle, preview) : null;
  const hintRect = Array.isArray(hint?.target) && hint.target.length === 4 ? (hint.target as Rect) : null;
  const lastCentre = last ? [last.rect[0] + last.rect[2] / 2, last.rect[1] + last.rect[3] / 2] : [0, 0];
  const box = (r: Rect): CSSProperties => ({ left: PAD + r[1] * cell, top: PAD + r[0] * cell, width: r[3] * cell, height: r[2] * cell });
  const boardPx = cols * cell + PAD * 2;

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "100%" }}>
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Quilt board, ${rows} by ${cols}, ${total} numbers`}
        aria-rowcount={rows}
        aria-colcount={cols}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        className="relative touch-none rounded-[20px] select-none"
        style={{ width: boardPx, height: rows * cell + PAD * 2, padding: PAD, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
      >
        <div className="grid overflow-hidden rounded-[14px]" style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)` }}>
          {Array.from({ length: rows }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                const k = rects.findIndex((x) => inRect(x, r, c));
                const clue = clueAt.get(i);
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-selected={k >= 0}
                    aria-label={`Row ${r + 1}, column ${c + 1}${clue ? `, number ${clue}` : ""}${k >= 0 ? `, in a rectangle of area ${area(rects[k])}${a.bad.has(k) ? ", breaks a rule" : ""}` : ", empty"}`}
                    className="outline-none focus-visible:z-30"
                    style={{ width: cell, height: cell, background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* placed rectangles */}
        {rects.map((r, k) => {
          const bad = a.bad.has(k);
          const isLast = last && sameRect(last.rect, r);
          const dist = Math.abs(r[0] + r[2] / 2 - lastCentre[0]) + Math.abs(r[1] + r[3] / 2 - lastCentre[1]);
          const anim = done ? "" : isLast ? (last!.bad ? (last!.n % 2 ? "cell-shake-a" : "cell-shake-b") : last!.n % 2 ? "cell-pop-a" : "cell-pop-b") : "";
          return (
            <div
              key={`${r.join(",")}`}
              aria-hidden
              className={`pointer-events-none absolute ${anim}`}
              style={{
                ...box(r),
                background: bad ? "var(--danger-tint)" : SHADES[shades[k]],
                boxShadow: bad ? "inset 0 0 0 3px var(--danger)" : "inset 0 0 0 3px var(--bg)",
                ...(done ? { animation: `cell-flip 500ms var(--ease-out) ${Math.round(dist) * 70}ms both` } : {}),
              }}
            >
              {bad && <span className="hatch absolute inset-[3px]" />}
              {done && <span className="absolute inset-[3px]" style={{ background: "var(--world)", animation: `fade-in 1ms linear ${Math.round(dist) * 70 + 250}ms both` }} />}
            </div>
          );
        })}

        {/* drag preview */}
        {preview && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-[4px]"
            style={{
              ...box(preview),
              background: "color-mix(in srgb, var(--world) 22%, transparent)",
              boxShadow: `inset 0 0 0 3px ${previewBreak === "none" || previewBreak === "many" ? "var(--danger)" : "var(--world)"}`,
            }}
          />
        )}

        {/* hint ring */}
        {hintRect && !done && (
          <div aria-hidden className="hint-ring pointer-events-none absolute" style={{ ...box(hintRect), boxShadow: "inset 0 0 0 4px var(--accent)" }} />
        )}

        {/* clue badges */}
        {puzzle.clues.map(([i, n]) => {
          const r = Math.floor(i / cols), c = i % cols;
          const k = rects.findIndex((x) => inRect(x, r, c));
          const filled = k >= 0 && !a.bad.has(k);
          const badge = Math.round(Math.min(30, Math.max(24, cell * 0.56)));
          return (
            <span
              key={i}
              aria-hidden
              className="num pointer-events-none absolute flex items-center justify-center rounded-full font-bold"
              style={{
                left: PAD + c * cell + (cell - badge) / 2,
                top: PAD + r * cell + (cell - badge) / 2,
                width: badge,
                height: badge,
                fontSize: 14,
                background: filled || done ? INK : k >= 0 ? "var(--danger)" : "var(--text)",
                color: filled || done ? "var(--world)" : k >= 0 ? INK : "var(--bg)",
              }}
            >
              {n}
            </span>
          );
        })}

        {/* area counter rides the finger */}
        {drag?.moved && preview && (
          <div
            aria-hidden
            className="num pointer-events-none absolute z-40 flex h-11 min-w-11 items-center justify-center gap-1 rounded-[14px] px-2.5 text-[20px] font-semibold"
            style={{
              left: 0,
              top: 0,
              transform: `translate(${Math.min(boardPx - 60, Math.max(0, drag.x - 22))}px, ${Math.max(-50, drag.y - 66)}px)`,
              background: previewBreak ? "var(--surface)" : "var(--world)",
              color: previewBreak ? (previewBreak === "area" ? "var(--text)" : "var(--danger)") : INK,
              boxShadow: "var(--shadow-float)",
            }}
          >
            {previewBreak === "none" || previewBreak === "many" ? <Icon name="warning" size={16} /> : !previewBreak ? <Icon name="check" size={16} /> : null}
            {area(preview)}
          </div>
        )}
      </div>
    </div>
  );
}
