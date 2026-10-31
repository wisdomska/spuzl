"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { logicGames } from "@/lib/copy/logic-games";
import { analyze, EMPTY, MOON, SUN, type DuskPuzzle, type DuskState } from "./logic";
import { isSlip, SETTLE_MS, tapMark, type Tool } from "./input";

const t = logicGames.dusk;
const GAP = 4;
const PAD = 6;
const MARK = 18;

/* Tile looks (Game Boards: Dusk). Light theme: --line matches the board, so moons use the muted ink tile. */
const LOOK = {
  empty: "bg-[var(--surface)] text-[var(--text)]",
  sun: "bg-[var(--world)] text-[#0E0F1A]",
  moon: "bg-[var(--line)] text-[var(--text)] [[data-theme=light]_&]:bg-[var(--text-muted)] [[data-theme=light]_&]:text-[var(--surface)]",
};
const GIVEN_RING = "color-mix(in srgb, var(--text-muted) 50%, var(--surface))";

const markName = (v: number) => (v === SUN ? t.mark.sun : v === MOON ? t.mark.moon : t.mark.empty);

/**
 * Dusk board (Game Boards: Dusk). Tap once for a sun, double-tap for a moon, tap again to clear.
 * Quick taps on one cell are one gesture and are judged only once they settle, so a cell passing
 * through sun on its way to moon never counts as a slip. With a tool selected, tap places that mark
 * or clears it. Keyboard: Space cycles, S / M place, Delete clears. Givens carry a ring and cannot
 * change. = and × badges sit on the shared edge of two cells and are read in both cells' labels.
 * Suns and moons differ by shape (icon), not only colour.
 */
export default function DuskBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<DuskPuzzle, DuskState>) {
  const n = puzzle.size;
  // `cells` follows every tap; `settled` is the last judged board (rule-break marks come from it).
  const [cells, setCells] = useState<DuskState>(() => initialState?.slice() ?? puzzle.givens.slice());
  const [settled, setSettled] = useState<DuskState>(cells);
  const [histLen, setHistLen] = useState(0);
  const [tool, setTool] = useState<Tool>(null);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const cellsRef = useRef(cells);
  const hist = useRef<DuskState[]>([]);
  const doneRef = useRef(false);
  /** the open tap burst: which cell, the board before it began, and its settle timer */
  const pending = useRef<{ i: number; before: DuskState; timer: number } | null>(null);
  const cell = useCellSize(n, GAP, PAD * 2, 56);
  const a = analyze(puzzle, settled);
  const given = (i: number) => puzzle.givens[i] !== EMPTY;

  const linkAt = (i: number) => puzzle.links.filter((l) => l.a === i || l.b === i);

  /** Judge one settled change: slip, clear or plain move. Transient marks never reach here. */
  const judge = useCallback(
    (i: number, prev: DuskState, next: DuskState) => {
      setSettled(next);
      if (prev[i] === next[i]) return;
      hist.current = [...hist.current, prev];
      setHistLen(hist.current.length);
      const after = analyze(puzzle, next);
      const broke = isSlip(puzzle, prev, next, i);
      const where = `${t.cellPrefix(Math.floor(i / n) + 1, (i % n) + 1)}, ${markName(next[i])}`;
      if (broke) {
        streak.current = 0;
        setShakeN((k) => k + 1);
        api.ruleBreak(after.message);
        api.announce(`${where}. ${after.message}`);
      } else if (after.clear) {
        doneRef.current = true;
        setDone(true);
        play("jingle");
        api.feedback(t.cleared, "success", "check-circle");
        api.announce(t.clearedAnnounce);
      } else {
        if (next[i] !== EMPTY) streak.current++;
        api.announce(where);
        if (after.bad.size === 0) api.feedback(t.filled(after.filled, n * n), "info", "sun-horizon");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, n, puzzle],
  );

  /** Close the open tap burst (if any) and judge where it landed. */
  const settle = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    judge(p.i, p.before, cellsRef.current);
  }, [judge]);
  const settleRef = useRef(settle);
  useEffect(() => {
    settleRef.current = settle;
  }, [settle]);
  useEffect(() => () => window.clearTimeout(pending.current?.timer), []);
  // Pausing or locking judges an open burst straight away.
  useEffect(() => {
    if (disabled) settle();
  }, [disabled, settle]);

  /** Show a mark right away (pop + sound); judging waits for `settle`. */
  const show = useCallback((i: number, value: number) => {
    const next = cellsRef.current.slice();
    next[i] = value;
    cellsRef.current = next;
    setCells(next);
    setLast(i);
    setTapN((k) => k + 1);
    play("pop", { step: streak.current });
  }, []);

  const blocked = useCallback(
    (i: number) => {
      if (disabled || doneRef.current) return true;
      if (puzzle.givens[i] !== EMPTY) {
        api.feedback(t.fixed, "info", "lock-simple");
        return true;
      }
      return false;
    },
    [api, disabled, puzzle],
  );

  /** Tap (or Space): advance the cell; quick repeat taps on the same cell are one gesture. */
  const tap = useCallback(
    (i: number) => {
      if (blocked(i)) return;
      if (pending.current && pending.current.i !== i) settle();
      const open = pending.current;
      if (open) window.clearTimeout(open.timer);
      const before = open?.before ?? cellsRef.current;
      show(i, tapMark(cellsRef.current[i], tool));
      pending.current = { i, before, timer: window.setTimeout(() => settleRef.current(), SETTLE_MS) };
    },
    [blocked, settle, show, tool],
  );

  /** Keyboard S / M / Delete: place a mark directly, judged at once. */
  const place = useCallback(
    (i: number, value: number) => {
      if (blocked(i)) return;
      settle();
      const before = cellsRef.current;
      if (before[i] === value) return;
      show(i, value);
      judge(i, before, cellsRef.current);
    },
    [blocked, settle, show, judge],
  );

  const undo = useCallback(() => {
    settle();
    const h = hist.current;
    if (!h.length || doneRef.current) return;
    const prev = h[h.length - 1];
    hist.current = h.slice(0, -1);
    setHistLen(hist.current.length);
    cellsRef.current = prev;
    setCells(prev);
    setSettled(prev);
    api.onMove(prev);
  }, [api, settle]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !histLen || done },
      { id: "sun", label: "Sun", icon: "sun", onPress: () => setTool((v) => (v === "sun" ? null : "sun")), active: tool === "sun" },
      { id: "moon", label: "Moon", icon: "moon", onPress: () => setTool((v) => (v === "moon" ? null : "moon")), active: tool === "moon" },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, histLen, done, tool]);

  useEffect(() => {
    api.feedback(t.howTo, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, tap);
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const v = k === "s" ? SUN : k === "m" ? MOON : k === "delete" || k === "backspace" ? EMPTY : -1;
    if (v < 0 || e.metaKey || e.ctrlKey || e.altKey) return keys.onKeyDown(e);
    e.preventDefault();
    place(keys.focus, v);
  };
  const lastR = Math.floor(last / n),
    lastC = last % n;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const step = cell + GAP;

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "100%" }}>
      <div
        role="grid"
        aria-label={t.boardLabel(n)}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={onKeyDown}
        className="relative grid rounded-[16px]"
        style={{
          gridTemplateColumns: `repeat(${n}, ${cell}px)`,
          gap: GAP,
          padding: PAD,
          background: "var(--board-bg)",
          boxShadow: "0 0 0 2px var(--line)",
          perspective: 600,
        }}
      >
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const v = cells[i];
              const bad = a.bad.has(i);
              const fixed = given(i);
              const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
              let anim = "";
              if (!done && i === last) anim = bad ? shakeClass(shakeN) : popClass(tapN);
              const glow = i === hintTarget && !done;
              const look = v === SUN ? LOOK.sun : v === MOON ? LOOK.moon : LOOK.empty;
              const rings = [
                fixed ? `inset 0 0 0 2px ${GIVEN_RING}` : "",
                glow ? "inset 0 0 0 4px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : "",
              ].filter(Boolean);
              // "Row 1, column 2, sun, equals the cell to the right"
              const label = [
                t.cellPrefix(r + 1, c + 1),
                markName(v),
                fixed ? t.given : "",
                ...linkAt(i).map((l) => {
                  const other = l.a === i ? l.b : l.a;
                  return t.link(l.same, other === i + 1 ? "right" : other === i - 1 ? "left" : other > i ? "below" : "above");
                }),
                bad ? t.breaksRule : "",
              ].filter(Boolean);
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={label.join(", ")}
                  aria-readonly={fixed || undefined}
                  onClick={() => {
                    keys.setFocus(i);
                    tap(i);
                  }}
                  className={`relative flex touch-manipulation items-center justify-center rounded-[10px] outline-none select-none focus-visible:z-10 ${fixed ? "cursor-default" : "cursor-pointer"} ${look} ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{ width: cell, height: cell, boxShadow: rings.join(", ") || undefined, color: bad ? "var(--danger)" : undefined }}
                >
                  {done && <span aria-hidden className="absolute inset-0" style={waveStyle(dist, "var(--world)")} />}
                  {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[10px]" />}
                  {v === SUN && (
                    <Icon name="sun" size={Math.round(cell * 0.55)} className="relative" style={done ? { color: "#0E0F1A" } : undefined} />
                  )}
                  {v === MOON && (
                    <Icon name="moon" size={Math.round(cell * 0.5)} className="relative" style={done ? { color: "#0E0F1A" } : undefined} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {puzzle.links.map((l) => {
          const r = Math.floor(l.a / n),
            c = l.a % n;
          const horiz = l.b === l.a + 1;
          const x = horiz ? PAD + (c + 1) * step - GAP / 2 - MARK / 2 : PAD + c * step + cell / 2 - MARK / 2;
          const y = horiz ? PAD + r * step + cell / 2 - MARK / 2 : PAD + (r + 1) * step - GAP / 2 - MARK / 2;
          return (
            <span
              key={`${l.a}-${l.b}`}
              aria-hidden
              className={`num pointer-events-none absolute z-10 flex items-center justify-center rounded-[6px] text-[13px] font-bold`}
              style={{
                left: x,
                top: y,
                width: MARK,
                height: MARK,
                background: "var(--text)",
                color: "var(--bg)",
                boxShadow: "0 0 0 2px var(--board-bg)",
              }}
            >
              {l.same ? "=" : "×"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
