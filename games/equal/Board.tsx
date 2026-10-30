"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { analyze, OP_GLYPH, type EqualPuzzle, type EqualState } from "./logic";

const INK = "#0E0F1A";

/**
 * Equal board. Numbers sit in a square with operators between them; each row ends "= result" and
 * each column ends with its result below. Tap a blank, then a number from the tray (or drag a number
 * onto a blank). Tap a placed number to send it back. A full line that is false shakes and hatches.
 */
export default function EqualBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<EqualPuzzle, EqualState>) {
  const { n } = puzzle;
  const blanks = useMemo(() => puzzle.given.flatMap((g, i) => (g ? [] : [i])), [puzzle.given]);
  const [cells, setCells] = useState<EqualState>(() => initialState?.slice() ?? new Array(n * n).fill(0));
  const [hist, setHist] = useState<EqualState[]>([]);
  const [sel, setSel] = useState(blanks[0] ?? 0);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [done, setDone] = useState(false);
  const [drag, setDrag] = useState<{ v: number; x: number; y: number } | null>(null);
  const ref = useRef(cells);
  const wrapRef = useRef<HTMLDivElement>(null);
  const streak = useRef(0);
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const on = () => setWidth(Math.min(358, window.innerWidth - 36));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const OPW = n > 3 ? 20 : 24;
  const GAP = n > 3 ? 4 : 6;
  const cell = Math.max(44, Math.min(64, Math.floor((width - 12 - OPW * n - GAP * 2 * n) / (n + 1))));
  const a = analyze(puzzle, cells);
  const used = blanks.map((i) => cells[i]).filter(Boolean);
  const tray = (() => {
    const left = used.slice();
    return puzzle.pool.map((v) => {
      const k = left.indexOf(v);
      if (k >= 0) {
        left.splice(k, 1);
        return { v, used: true };
      }
      return { v, used: false };
    });
  })();

  const set = useCallback(
    (i: number, v: number) => {
      if (disabled || done || puzzle.given[i]) return;
      const prev = ref.current;
      if (prev[i] === v) return;
      const next = prev.slice();
      // a number lives in one blank at a time: moving it clears its old spot
      if (v) {
        const avail = puzzle.pool.filter((x) => x === v).length;
        const placed = blanks.filter((j) => j !== i && next[j] === v);
        if (placed.length >= avail) next[placed[0]] = 0;
      }
      next[i] = v;
      ref.current = next;
      setCells(next);
      setHist((h) => [...h, prev]);
      setLast(i);
      setTapN((t) => t + 1);
      const before = analyze(puzzle, prev);
      const after = analyze(puzzle, next);
      const broke = v !== 0 && after.bad.has(i) && !before.bad.has(i);
      const r = Math.floor(i / n) + 1,
        c = (i % n) + 1;
      if (broke) {
        streak.current = 0;
        api.ruleBreak(after.message);
        api.announce(`Row ${r}, column ${c}, ${v}. ${after.message}`);
      } else if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback("Every equation is true. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else {
        if (v) streak.current++;
        play(v ? "pop" : "tick", { step: streak.current });
        api.announce(`Row ${r}, column ${c}, ${v || "empty"}`);
        api.feedback(
          mode === "tutorial" && after.filled === 1
            ? "Each row and column must work out to its result."
            : `${after.filled} of ${blanks.length} placed`,
          "info",
          "equals",
        );
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, blanks, disabled, done, mode, n, puzzle],
  );

  /** Next empty blank after i, for flow. */
  const nextBlank = (i: number, st: EqualState) => blanks.find((j) => j > i && !st[j]) ?? blanks.find((j) => !st[j]) ?? i;

  const placeFromTray = (v: number) => {
    if (puzzle.given[sel]) return;
    set(sel, v);
    setSel(nextBlank(sel, ref.current));
  };

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
    if (done || !prev.some(Boolean)) return;
    const next = new Array(n * n).fill(0);
    ref.current = next;
    setCells(next);
    setHist((h) => [...h, prev]);
    play("tick");
    api.onMove(next);
    api.feedback(`0 of ${blanks.length} placed`, "info", "equals");
  }, [api, blanks.length, done, n]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "clear", label: "Clear", icon: "eraser", onPress: clearAll, disabled: !cells.some(Boolean) || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, clearAll, hist.length, cells, done]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Tap a blank, then a number. × and ÷ go first." : `0 of ${blanks.length} placed`,
      "info",
      mode === "tutorial" ? "hand-pointing" : "equals",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapCell = useCallback(
    (i: number) => {
      if (puzzle.given[i]) {
        api.announce(`Given ${puzzle.given[i]}`);
        return;
      }
      if (ref.current[i] && sel === i) {
        set(i, 0);
        return;
      }
      setSel(i);
      play("tick");
    },
    [api, puzzle.given, sel, set],
  );
  const keys = useGridKeys(n, n, tapCell);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      set(keys.focus, 0);
      return;
    }
    keys.onKeyDown(e);
  };

  /* drag a tray number onto a blank */
  const onChipDown = (v: number) => (e: PointerEvent) => {
    if (disabled || done) return;
    const b = wrapRef.current!.getBoundingClientRect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ v, x: e.clientX - b.left, y: e.clientY - b.top });
  };
  const onChipMove = (e: PointerEvent) => {
    if (!drag) return;
    const b = wrapRef.current!.getBoundingClientRect();
    setDrag({ ...drag, x: e.clientX - b.left, y: e.clientY - b.top });
  };
  const onChipUp = (v: number) => (e: PointerEvent) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const target = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => el instanceof HTMLElement && el.dataset.i !== undefined) as HTMLElement | undefined;
    if (target) {
      const i = Number(target.dataset.i);
      if (!puzzle.given[i]) {
        setSel(i);
        set(i, v);
        setSel(nextBlank(i, ref.current));
        return;
      }
    }
    placeFromTray(v);
  };

  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const lastR = Math.floor(last / n),
    lastC = last % n;
  const cols = 2 * n + 1;
  const template = Array.from({ length: cols }, (_, j) => (j % 2 === 0 ? `${cell}px` : `${OPW}px`)).join(" ");
  const at = (row: number, col: number): CSSProperties => ({ gridRow: row + 1, gridColumn: col + 1 });
  const font = Math.round(cell * (n === 3 ? 0.44 : 0.4));

  return (
    <div ref={wrapRef} className="relative flex flex-col items-center gap-4" style={{ width }}>
      <div
        role="grid"
        aria-label={`Equal board, ${n} by ${n}. Rows read left to right, columns top to bottom.`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={onKey}
        className={`grid items-center justify-items-center rounded-[20px] p-1.5 ${done ? "board-pulse" : ""}`}
        style={{
          gridTemplateColumns: template,
          gridTemplateRows: template,
          gap: GAP,
          background: "var(--board-bg)",
          boxShadow: "0 0 0 2px var(--line)",
          perspective: 600,
        }}
      >
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={`r${r}`} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const g = puzzle.given[i];
              const v = g || cells[i];
              const bad = a.bad.has(i);
              const isSel = !g && sel === i && !done;
              const glow = i === hintTarget;
              const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
              let anim = "";
              if (!done && i === last) anim = bad ? (tapN % 2 ? "cell-shake-a" : "cell-shake-b") : tapN % 2 ? "cell-pop-a" : "cell-pop-b";
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-readonly={!!g}
                  aria-selected={isSel}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${g ? `given ${g}` : v ? v : "blank"}${bad ? ", line not true" : ""}`}
                  onClick={() => {
                    keys.setFocus(i);
                    tapCell(i);
                  }}
                  className={`num relative flex items-center justify-center rounded-[12px] font-semibold outline-none focus-visible:z-10 ${g ? "" : "cursor-pointer"} ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{
                    ...at(r * 2, c * 2),
                    width: cell,
                    height: cell,
                    fontSize: font,
                    background: g
                      ? "var(--surface)"
                      : v
                        ? "color-mix(in srgb, var(--world) 22%, var(--surface-raised))"
                        : "var(--surface-raised)",
                    color: bad ? "var(--danger)" : "var(--text)",
                    boxShadow: glow
                      ? "inset 0 0 0 4px var(--accent)"
                      : bad
                        ? "inset 0 0 0 3px var(--danger)"
                        : isSel
                          ? "inset 0 0 0 3px var(--world)"
                          : g
                            ? "none"
                            : v
                              ? "none"
                              : "inset 0 0 0 2px var(--line)",
                  }}
                >
                  {done && !g && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[12px]"
                      style={{ background: "var(--world)", animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both` }}
                    />
                  )}
                  {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[12px]" />}
                  <span className="relative" style={done && !g ? { color: INK } : undefined}>
                    {v || ""}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {/* operators, equals signs and results (decorative; the cells carry the meaning for screen readers) */}
        {puzzle.rowOps.map((ops, r) =>
          ops.map((o, k) => (
            <span key={`ro${r}-${k}`} aria-hidden className="num text-muted text-[20px] font-semibold" style={at(r * 2, k * 2 + 1)}>
              {OP_GLYPH[o]}
            </span>
          )),
        )}
        {puzzle.colOps.map((ops, c) =>
          ops.map((o, k) => (
            <span
              key={`co${c}-${k}`}
              aria-hidden
              className="num text-muted text-[20px] leading-none font-semibold"
              style={at(k * 2 + 1, c * 2)}
            >
              {OP_GLYPH[o]}
            </span>
          )),
        )}
        {puzzle.rowRes.map((v, r) => (
          <span key={`re${r}`} aria-hidden className="contents">
            <span className="num text-muted text-[20px] font-semibold" style={at(r * 2, n * 2 - 1)}>
              =
            </span>
          </span>
        ))}
        {puzzle.rowRes.map((v, r) => (
          <span
            key={`rv${r}`}
            aria-label={`Row ${r + 1} equals ${v}`}
            className="num flex items-center justify-center rounded-[12px] font-semibold"
            style={{
              ...at(r * 2, n * 2),
              width: cell,
              height: cell,
              fontSize: Math.round(font * (String(v).length > 2 ? 0.75 : 1)),
              background: "var(--world)",
              color: INK,
            }}
          >
            {v}
          </span>
        ))}
        {puzzle.colRes.map((v, c) => (
          <span key={`ce${c}`} aria-hidden className="num text-muted text-[20px] leading-none font-semibold" style={at(n * 2 - 1, c * 2)}>
            =
          </span>
        ))}
        {puzzle.colRes.map((v, c) => (
          <span
            key={`cv${c}`}
            aria-label={`Column ${c + 1} equals ${v}`}
            className="num flex items-center justify-center rounded-[12px] font-semibold"
            style={{
              ...at(n * 2, c * 2),
              width: cell,
              height: cell,
              fontSize: Math.round(font * (String(v).length > 2 ? 0.75 : 1)),
              background: "var(--world)",
              color: INK,
            }}
          >
            {v}
          </span>
        ))}
      </div>

      <div className="flex w-full flex-wrap justify-center gap-2" role="group" aria-label="Numbers to place">
        {tray.map((t, k) => (
          <button
            key={k}
            type="button"
            disabled={disabled || done || t.used}
            aria-label={`Place ${t.v}`}
            onClick={(e) => {
              if (e.detail === 0) placeFromTray(t.v);
            }}
            onPointerDown={onChipDown(t.v)}
            onPointerMove={onChipMove}
            onPointerUp={onChipUp(t.v)}
            onPointerCancel={() => setDrag(null)}
            className="press num flex h-12 min-w-12 touch-none items-center justify-center rounded-[14px] px-2 text-[22px] font-semibold"
            style={{
              background: "var(--surface-raised)",
              boxShadow: "0 4px 0 var(--depth)",
              opacity: t.used ? 0.3 : drag?.v === t.v ? 0.5 : 1,
            }}
          >
            {t.v}
          </button>
        ))}
      </div>

      {drag && (
        <div
          aria-hidden
          className="num pointer-events-none absolute top-0 left-0 z-40 flex h-12 min-w-12 items-center justify-center rounded-[14px] px-2 text-[22px] font-semibold"
          style={{
            transform: `translate(${drag.x - 24}px, ${drag.y - 60}px) scale(1.08)`,
            background: "var(--world)",
            color: INK,
            boxShadow: "var(--shadow-float)",
          }}
        >
          {drag.v}
        </div>
      )}
    </div>
  );
}
