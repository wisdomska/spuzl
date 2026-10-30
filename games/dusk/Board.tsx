"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { analyze, EMPTY, MOON, SUN, type DuskPuzzle, type DuskState } from "./logic";

type Tool = "sun" | "moon" | null;
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

const markName = (v: number) => (v === SUN ? "sun" : v === MOON ? "moon" : "empty");

/**
 * Dusk board (Game Boards: Dusk). Tap cycles sun, moon, empty. With a tool selected, tap places that
 * mark or clears it. Givens carry a ring and cannot change. = and × badges sit on the shared edge of
 * two cells. Suns and moons differ by shape (icon), not only colour.
 */
export default function DuskBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<DuskPuzzle, DuskState>) {
  const n = puzzle.size;
  const [cells, setCells] = useState<DuskState>(() => initialState?.slice() ?? puzzle.givens.slice());
  const [hist, setHist] = useState<DuskState[]>([]);
  const [tool, setTool] = useState<Tool>(null);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const cellsRef = useRef(cells);
  const cell = useCellSize(n, GAP, PAD * 2, 56);
  const a = analyze(puzzle, cells);
  const given = (i: number) => puzzle.givens[i] !== EMPTY;

  const linkAt = (i: number) => puzzle.links.filter((l) => l.a === i || l.b === i);

  const commit = useCallback(
    (i: number, value: number) => {
      if (disabled || done) return;
      const prev = cellsRef.current;
      if (prev[i] === value) return;
      const next = prev.slice();
      next[i] = value;
      cellsRef.current = next;
      const before = analyze(puzzle, prev);
      const after = analyze(puzzle, next);
      const broke = after.bad.size > before.bad.size && after.bad.has(i);
      setCells(next);
      setHist((h) => [...h, prev]);
      setLast(i);
      setTapN((t) => t + 1);
      const where = `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}, ${markName(value)}`;
      if (broke) {
        streak.current = 0;
        setShakeN((k) => k + 1);
        api.ruleBreak(after.message);
        api.announce(`${where}. ${after.message}`);
      } else if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback("Balanced. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else {
        if (value !== EMPTY) streak.current++;
        play("pop", { step: streak.current });
        api.announce(where);
        if (after.bad.size === 0) api.feedback(`${after.filled} of ${n * n} filled`, "info", "sun-horizon");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, disabled, done, n, puzzle],
  );

  const cycle = useCallback(
    (i: number) => {
      if (given(i)) {
        if (!disabled && !done) api.feedback("That one is fixed. It came with the puzzle.", "info", "lock-simple");
        return;
      }
      const v = cellsRef.current[i];
      const next = tool === "sun" ? (v === SUN ? EMPTY : SUN) : tool === "moon" ? (v === MOON ? EMPTY : MOON) : (v + 1) % 3;
      commit(i, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, tool, api, disabled, done, puzzle],
  );

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      cellsRef.current = prev;
      setCells(prev);
      api.onMove(prev);
      return h.slice(0, -1);
    });
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "sun", label: "Sun", icon: "sun", onPress: () => setTool((t) => (t === "sun" ? null : "sun")), active: tool === "sun" },
      { id: "moon", label: "Moon", icon: "moon", onPress: () => setTool((t) => (t === "moon" ? null : "moon")), active: tool === "moon" },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done, tool]);

  useEffect(() => {
    if (mode === "tutorial") api.feedback("Tap once for a sun, twice for a moon.", "info", "hand-pointing");
    else api.feedback("Tap cycles sun, moon, empty.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, cycle);
  const lastR = Math.floor(last / n), lastC = last % n;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const step = cell + GAP;

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "100%" }}>
      <div
        role="grid"
        aria-label={`Dusk board, ${n} by ${n}`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={keys.onKeyDown}
        className="relative grid rounded-[16px]"
        style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)`, gap: GAP, padding: PAD, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
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
              const rings = [fixed ? `inset 0 0 0 2px ${GIVEN_RING}` : "", glow ? "inset 0 0 0 4px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : ""].filter(Boolean);
              const links = linkAt(i)
                .map((l) => {
                  const other = l.a === i ? l.b : l.a;
                  const dir = other === i + 1 ? "right" : other === i - 1 ? "left" : other > i ? "below" : "above";
                  return `${l.same ? "same as" : "different from"} the cell ${dir}`;
                })
                .join(", ");
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${markName(v)}${fixed ? ", given" : ""}${links ? `, ${links}` : ""}${bad ? ", breaks a rule" : ""}`}
                  aria-readonly={fixed || undefined}
                  onClick={() => {
                    keys.setFocus(i);
                    cycle(i);
                  }}
                  className={`relative flex items-center justify-center rounded-[10px] outline-none focus-visible:z-10 ${fixed ? "cursor-default" : "cursor-pointer"} ${look} ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{ width: cell, height: cell, boxShadow: rings.join(", ") || undefined, color: bad ? "var(--danger)" : undefined }}
                >
                  {done && <span aria-hidden className="absolute inset-0" style={waveStyle(dist, "var(--world)")} />}
                  {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[10px]" />}
                  {v === SUN && <Icon name="sun" size={Math.round(cell * 0.55)} className="relative" style={done ? { color: "#0E0F1A" } : undefined} />}
                  {v === MOON && <Icon name="moon" size={Math.round(cell * 0.5)} className="relative" style={done ? { color: "#0E0F1A" } : undefined} />}
                </div>
              );
            })}
          </div>
        ))}
        {puzzle.links.map((l) => {
          const r = Math.floor(l.a / n), c = l.a % n;
          const horiz = l.b === l.a + 1;
          const x = horiz ? PAD + (c + 1) * step - GAP / 2 - MARK / 2 : PAD + c * step + cell / 2 - MARK / 2;
          const y = horiz ? PAD + r * step + cell / 2 - MARK / 2 : PAD + (r + 1) * step - GAP / 2 - MARK / 2;
          return (
            <span
              key={`${l.a}-${l.b}`}
              aria-hidden
              className={`pointer-events-none absolute z-10 flex items-center justify-center rounded-[6px] text-[13px] font-bold num `}
              style={{ left: x, top: y, width: MARK, height: MARK, background: "var(--text)", color: "var(--bg)", boxShadow: "0 0 0 2px var(--board-bg)" }}
            >
              {l.same ? "=" : "×"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
