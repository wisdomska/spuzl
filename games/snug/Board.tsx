"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import {
  cellsOf,
  FIT_COPY,
  fitBreak,
  occupancy,
  rotate,
  verify,
  type Cell,
  type Placement,
  type SnugPuzzle,
  type SnugState,
} from "./logic";

const GAP = 2;
const PAD = 6;
const SHADES = [
  "var(--world)",
  "color-mix(in srgb, var(--world) 70%, #fff)",
  "color-mix(in srgb, var(--world) 78%, #000)",
  "color-mix(in srgb, var(--world) 50%, #fff)",
  "color-mix(in srgb, var(--world) 60%, #000)",
];
/** a glyph per block so blocks never differ by colour alone */
const GLYPHS = ["●", "■", "▲", "◆", "★", "✚", "⬣", "▼", "◐", "✱"];
const INK = "#0E0F1A";

interface Drag {
  k: number;
  grab: Cell;
  x: number;
  y: number;
  sx: number;
  sy: number;
  moved: boolean;
  /** bounding-box origin under the finger, null when off the outline */
  at: Cell | null;
}

/**
 * Snug board. Drag a block from the tray onto the outline; tap a block to rotate it a quarter turn.
 * Dragging a placed block off the outline sends it back to the tray. Keyboard: Tab to a block, Enter
 * picks it up, arrows move over the outline, Enter drops, R rotates, Delete returns the focused block.
 */
export default function SnugBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<SnugPuzzle, SnugState>) {
  const { rows, cols } = puzzle;
  const K = puzzle.pieces.length;
  const [rot, setRot] = useState<number[]>(() => puzzle.pieces.map((_, k) => initialState?.[k]?.rot ?? 0));
  const [pos, setPos] = useState<(Cell | null)[]>(() =>
    puzzle.pieces.map((_, k) => (initialState?.[k] ? [initialState[k]!.r, initialState[k]!.c] : null)),
  );
  const [hist, setHist] = useState<{ rot: number[]; pos: (Cell | null)[] }[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [last, setLast] = useState<{ k: number; n: number; bad: boolean; at: Cell } | null>(null);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const ref = useRef({ rot, pos });
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const on = () => setWidth(Math.min(358, window.innerWidth - 36));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const cell = Math.max(44, Math.min(56, Math.floor((width - PAD * 2 - GAP * (cols - 1)) / cols)));
  const pitch = cell + GAP;
  const mini = 14;

  const toState = (r: number[], p: (Cell | null)[]): SnugState => p.map((x, k) => (x ? { r: x[0], c: x[1], rot: r[k] } : null));
  const state = toState(rot, pos);
  const occ = occupancy(puzzle, state);
  const placedCount = pos.filter(Boolean).length;

  const commit = useCallback(
    (nextRot: number[], nextPos: (Cell | null)[], info: { k: number; kind: "place" | "rotate" | "return"; at?: Cell }) => {
      const prev = ref.current;
      ref.current = { rot: nextRot, pos: nextPos };
      setHist((h) => [...h, prev]);
      setRot(nextRot);
      setPos(nextPos);
      const st = toState(nextRot, nextPos);
      const name = `Block ${info.k + 1}`;
      const solved = nextPos.every(Boolean) && verify(puzzle, [], st).ok;
      if (info.kind === "place") setLast((l) => ({ k: info.k, n: (l?.n ?? 0) + 1, bad: false, at: info.at ?? [0, 0] }));
      if (solved) {
        setDone(true);
        play("jingle");
        api.feedback("Snug fit. Board cleared.", "success", "check-circle");
        api.announce("Every block fits. Board cleared.");
      } else if (info.kind === "place") {
        streak.current++;
        play("pop", { step: streak.current });
        const n = nextPos.filter(Boolean).length;
        api.announce(`${name} placed at row ${info.at![0] + 1}, column ${info.at![1] + 1}. ${n} of ${K} blocks in.`);
        api.feedback(
          mode === "tutorial" && n === 1 ? "Tap a block to turn it. Fill the whole outline." : `${n} of ${K} blocks in`,
          "info",
          "puzzle-piece",
        );
      } else if (info.kind === "rotate") {
        play("tick");
        api.announce(`${name} rotated.`);
      } else {
        play("tick");
        api.announce(`${name} back in the tray.`);
        api.feedback(`${nextPos.filter(Boolean).length} of ${K} blocks in`, "info", "puzzle-piece");
      }
      api.onMove(st, { correctStreak: streak.current });
      if (solved) api.onSolved(st);
    },

    [api, K, mode, puzzle],
  );

  /** Try to drop block k with its bounding box at `at`. */
  const drop = useCallback(
    (k: number, at: Cell, r = ref.current.rot[k]) => {
      if (disabled || done) return false;
      const cur = ref.current;
      const pl: Placement = { r: at[0], c: at[1], rot: r };
      const why = fitBreak(puzzle, toState(cur.rot, cur.pos), k, pl);
      if (why) {
        streak.current = 0;
        setLast((l) => ({ k, n: (l?.n ?? 0) + 1, bad: true, at }));
        api.ruleBreak(FIT_COPY[why]);
        api.onMove(toState(cur.rot, cur.pos), { correctStreak: 0, mistake: true });
        return false;
      }
      const nextRot = cur.rot.slice();
      nextRot[k] = r;
      const nextPos = cur.pos.slice();
      nextPos[k] = at;
      commit(nextRot, nextPos, { k, kind: "place", at });
      return true;
    },

    [api, commit, disabled, done, puzzle],
  );

  const turn = useCallback(
    (k: number) => {
      if (disabled || done) return;
      const cur = ref.current;
      const r = (cur.rot[k] + 1) % 4;
      const nextRot = cur.rot.slice();
      nextRot[k] = r;
      const at = cur.pos[k];
      if (at && fitBreak(puzzle, toState(cur.rot, cur.pos), k, { r: at[0], c: at[1], rot: r })) {
        // turned in place it would not fit: send it back to the tray, turned
        const nextPos = cur.pos.slice();
        nextPos[k] = null;
        commit(nextRot, nextPos, { k, kind: "return" });
        api.feedback("Turned. It no longer fit there, so it went back to the tray.", "info", "arrows-clockwise");
        return;
      }
      commit(nextRot, cur.pos, { k, kind: "rotate" });
    },

    [api, commit, disabled, done, puzzle],
  );

  const toTray = useCallback(
    (k: number) => {
      const cur = ref.current;
      if (!cur.pos[k] || disabled || done) return;
      const nextPos = cur.pos.slice();
      nextPos[k] = null;
      commit(cur.rot, nextPos, { k, kind: "return" });
    },
    [commit, disabled, done],
  );

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      ref.current = prev;
      setRot(prev.rot);
      setPos(prev.pos);
      play("tick");
      api.onMove(toState(prev.rot, prev.pos));
      return h.slice(0, -1);
    });
  }, [api]);

  const clearAll = useCallback(() => {
    const cur = ref.current;
    if (!cur.pos.some(Boolean) || done) return;
    setHist((h) => [...h, cur]);
    const nextPos = cur.pos.map(() => null);
    ref.current = { rot: cur.rot, pos: nextPos };
    setPos(nextPos);
    play("tick");
    api.onMove(toState(cur.rot, nextPos));
    api.feedback(`0 of ${K} blocks in`, "info", "puzzle-piece");
  }, [api, K, done]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "clear", label: "Clear", icon: "eraser", onPress: clearAll, disabled: !placedCount || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, clearAll, hist.length, placedCount, done]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Drag a block into the outline. Tap it to turn." : `0 of ${K} blocks in`,
      "info",
      mode === "tutorial" ? "hand-pointing" : "puzzle-piece",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- keyboard ---------- */
  const onGridSpace = useCallback(
    (i: number) => {
      const at: Cell = [Math.floor(i / cols), i % cols];
      if (held !== null) {
        if (drop(held, at)) setHeld(null);
        return;
      }
      const k = occupancy(puzzle, toState(ref.current.rot, ref.current.pos))[i];
      if (k >= 0) {
        setHeld(k);
        api.announce(`Block ${k + 1} picked up. Move and press Enter to drop it. R turns it.`);
      }
    },

    [api, cols, drop, held, puzzle],
  );
  const keys = useGridKeys(rows, cols, onGridSpace);
  const onGridKey = (e: KeyboardEvent) => {
    if ((e.key === "r" || e.key === "R") && held !== null) {
      e.preventDefault();
      turn(held);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const k = occ[keys.focus];
      if (k >= 0) toTray(k);
      return;
    }
    if (e.key === "Escape") setHeld(null);
    keys.onKeyDown(e);
  };

  /* ---------- pointer ---------- */
  const rel = (e: PointerEvent) => {
    const b = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const startDrag = (k: number, grab: Cell, e: PointerEvent) => {
    if (disabled || done || e.button > 0) return;
    e.preventDefault();
    wrapRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = rel(e);
    setHeld(null);
    setDrag({ k, grab, x, y, sx: x, sy: y, moved: false, at: null });
  };
  const onGridDown = (e: PointerEvent) => {
    const g = gridRef.current!.getBoundingClientRect();
    const c = Math.floor((e.clientX - g.left - PAD) / pitch),
      r = Math.floor((e.clientY - g.top - PAD) / pitch);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    keys.setFocus(r * cols + c);
    const k = occ[r * cols + c];
    if (k < 0) return;
    const at = pos[k]!;
    startDrag(k, [r - at[0], c - at[1]], e);
  };
  /** Bounding-box origin for the dragged block under the pointer, or null when it is off the outline. */
  const originAt = (e: PointerEvent, grab: Cell): Cell | null => {
    const g = gridRef.current!.getBoundingClientRect();
    const px = e.clientX - g.left - PAD,
      py = e.clientY - g.top - PAD;
    const over = px >= -pitch / 2 && py >= -pitch / 2 && px < cols * pitch + pitch / 2 && py < rows * pitch + pitch / 2;
    return over ? [Math.floor(py / pitch) - grab[0], Math.floor(px / pitch) - grab[1]] : null;
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const { x, y } = rel(e);
    setDrag({ ...drag, x, y, moved: drag.moved || Math.hypot(x - drag.sx, y - drag.sy) > 6, at: originAt(e, drag.grab) });
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      turn(d.k);
      return;
    }
    const at = originAt(e, d.grab);
    if (!at) {
      toTray(d.k);
      return;
    }
    drop(d.k, at);
  };

  /* ---------- render ---------- */
  const hintT = hint?.target as { piece?: number; place?: Placement } | undefined;
  const hintCells = hintT?.place && hintT.piece !== undefined ? cellsOf(puzzle, hintT.piece, hintT.place) : [];
  const cellBox = (r: number, c: number): CSSProperties => ({ left: PAD + c * pitch, top: PAD + r * pitch, width: cell, height: cell });
  const lastAt = last?.at ?? [0, 0];
  const dragging = drag?.moved ? drag.k : -1;

  return (
    <div
      ref={wrapRef}
      className="relative flex touch-none flex-col items-center gap-4 select-none"
      style={{ width }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)}
    >
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Snug outline, ${rows} by ${cols}, ${K} blocks`}
        aria-rowcount={rows}
        aria-colcount={cols}
        onKeyDown={onGridKey}
        onPointerDown={onGridDown}
        className={`relative rounded-[20px] ${done ? "board-pulse" : ""}`}
        style={{
          width: cols * pitch - GAP + PAD * 2,
          height: rows * pitch - GAP + PAD * 2,
          background: "var(--board-bg)",
          boxShadow: "0 0 0 2px var(--line)",
          perspective: 600,
        }}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: cols }, (_, c) => {
              const i = r * cols + c;
              const inOutline = puzzle.outline[i] === 1;
              const k = occ[i];
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-selected={k >= 0}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${!inOutline ? "outside the outline" : k >= 0 ? `block ${k + 1}` : "empty"}`}
                  className="absolute rounded-[8px] outline-none focus-visible:z-30"
                  style={{
                    ...cellBox(r, c),
                    background: inOutline ? "var(--surface-raised)" : "transparent",
                    boxShadow: inOutline ? "inset 0 0 0 1px var(--line)" : "none",
                  }}
                />
              );
            })}
          </div>
        ))}

        {/* placed blocks */}
        {pos.map((at, k) => {
          if (!at || k === dragging) return null;
          const shape = rotate(puzzle.pieces[k], rot[k]);
          const isLast = last?.k === k;
          const anim = done ? "" : isLast ? (last!.n % 2 ? "cell-pop-a" : "cell-pop-b") : "";
          const held_ = held === k;
          return shape.map(([y, x], j) => {
            const r = at[0] + y,
              c = at[1] + x;
            const dist = Math.abs(r - lastAt[0]) + Math.abs(c - lastAt[1]);
            return (
              <div
                key={`${k}-${j}`}
                aria-hidden
                className={`pointer-events-none absolute flex items-center justify-center rounded-[8px] ${anim}`}
                style={{
                  ...cellBox(r, c),
                  background: SHADES[k % SHADES.length],
                  color: INK,
                  fontSize: Math.round(cell * 0.32),
                  boxShadow: held_ ? "inset 0 0 0 3px var(--text)" : "inset 0 -4px 0 rgb(0 0 0 / .18)",
                  ...(done ? { animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both` } : {}),
                }}
              >
                {done && (
                  <span
                    className="absolute inset-0 rounded-[8px]"
                    style={{ background: "var(--world)", animation: `fade-in 1ms linear ${dist * 70 + 250}ms both` }}
                  />
                )}
                {j === 0 && <span className="relative opacity-70">{GLYPHS[k % GLYPHS.length]}</span>}
              </div>
            );
          });
        })}

        {/* rule break flash */}
        {last?.bad && !drag && (
          <div
            key={last.n}
            aria-hidden
            className={`pointer-events-none absolute ${last.n % 2 ? "cell-shake-a" : "cell-shake-b"}`}
            style={{ inset: 0, animationFillMode: "both" }}
          >
            {rotate(puzzle.pieces[last.k], rot[last.k]).map(([y, x], j) => {
              const r = last.at[0] + y,
                c = last.at[1] + x;
              if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
              return (
                <div
                  key={j}
                  className="hatch absolute rounded-[8px]"
                  style={{
                    ...cellBox(r, c),
                    boxShadow: "inset 0 0 0 3px var(--danger)",
                    animation: "fade-in 1ms linear reverse 900ms both",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* hint outline */}
        {hintCells.map(([r, c], j) => (
          <div
            key={j}
            aria-hidden
            className="hint-ring pointer-events-none absolute rounded-[8px]"
            style={{ ...cellBox(r, c), boxShadow: "inset 0 0 0 3px var(--accent)" }}
          />
        ))}

        {/* drop preview while dragging */}
        {drag?.moved &&
          drag.at &&
          (() => {
            const at = drag.at;
            const cells = cellsOf(puzzle, drag.k, { r: at[0], c: at[1], rot: rot[drag.k] });
            if (cells.every(([r, c]) => r < 0 || c < 0 || r >= rows || c >= cols)) return null;
            const ok = !fitBreak(puzzle, state, drag.k, { r: at[0], c: at[1], rot: rot[drag.k] });
            return cells.map(([r, c], j) =>
              r < 0 || c < 0 || r >= rows || c >= cols ? null : (
                <div
                  key={j}
                  aria-hidden
                  className="pointer-events-none absolute rounded-[8px]"
                  style={{ ...cellBox(r, c), boxShadow: `inset 0 0 0 3px ${ok ? "var(--world)" : "var(--danger)"}` }}
                />
              ),
            );
          })()}
      </div>

      {/* tray */}
      <div className="flex w-full flex-wrap items-center justify-center gap-2.5" role="group" aria-label="Blocks to place">
        {puzzle.pieces.map((_, k) => {
          const shape = rotate(puzzle.pieces[k], rot[k]);
          const h = Math.max(...shape.map((x) => x[0])) + 1,
            w = Math.max(...shape.map((x) => x[1])) + 1;
          const placed = !!pos[k];
          const hinted = hintT?.piece === k;
          return (
            <button
              key={k}
              type="button"
              aria-label={`Block ${k + 1}, ${shape.length} squares${placed ? ", placed" : ""}${held === k ? ", picked up" : ""}`}
              aria-pressed={held === k}
              onKeyDown={(e) => {
                if (e.key === "r" || e.key === "R") {
                  e.preventDefault();
                  turn(k);
                }
              }}
              onClick={(e) => {
                // keyboard activation (detail 0): pick the block up and move focus to the outline
                if (e.detail !== 0) return;
                setHeld(k);
                api.announce(`Block ${k + 1} picked up. Use the arrows on the outline and press Enter to drop it. R turns it.`);
                gridRef.current?.querySelector<HTMLElement>(`[data-i="${keys.focus}"]`)?.focus();
              }}
              onPointerDown={(e) => {
                const t = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
                const j = t ? Number(t.dataset.cell) : 0;
                startDrag(k, shape[j], e);
              }}
              className={`relative flex items-center justify-center rounded-[14px] p-2 ${hinted ? "hint-ring" : ""}`}
              style={{
                minWidth: 48,
                minHeight: 48,
                background: "var(--surface)",
                boxShadow: hinted
                  ? "inset 0 0 0 3px var(--accent)"
                  : held === k
                    ? "inset 0 0 0 2px var(--text)"
                    : "inset 0 0 0 1px var(--line)",
                opacity: placed ? 0.35 : drag?.moved && drag.k === k ? 0.2 : 1,
                cursor: "grab",
              }}
            >
              <span className="relative block" style={{ width: w * (mini + 2) - 2, height: h * (mini + 2) - 2 }}>
                {shape.map(([y, x], j) => (
                  <span
                    key={j}
                    data-cell={j}
                    className="absolute flex items-center justify-center rounded-[3px] text-[9px]"
                    style={{
                      left: x * (mini + 2),
                      top: y * (mini + 2),
                      width: mini,
                      height: mini,
                      background: placed ? "var(--line)" : SHADES[k % SHADES.length],
                      color: INK,
                    }}
                  >
                    {j === 0 && !placed ? GLYPHS[k % GLYPHS.length] : ""}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* the block riding the finger */}
      {drag?.moved && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 z-40"
          style={{
            transform: `translate(${drag.x - drag.grab[1] * pitch - cell / 2}px, ${drag.y - drag.grab[0] * pitch - cell / 2}px) scale(1.04)`,
            filter: "drop-shadow(0 10px 18px rgb(0 0 0 / .45))",
          }}
        >
          {rotate(puzzle.pieces[drag.k], rot[drag.k]).map(([y, x], j) => (
            <div
              key={j}
              className="absolute flex items-center justify-center rounded-[8px]"
              style={{
                left: x * pitch,
                top: y * pitch,
                width: cell,
                height: cell,
                background: SHADES[drag.k % SHADES.length],
                color: INK,
                fontSize: Math.round(cell * 0.32),
                opacity: 0.92,
              }}
            >
              {j === 0 ? GLYPHS[drag.k % GLYPHS.length] : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
