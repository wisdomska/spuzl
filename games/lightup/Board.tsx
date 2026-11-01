"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { fitCell, useViewportWidth } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { LIGHTUP_COPY as T } from "@/lib/copy/lightup";
import { analyze, BLACK, EMPTY, geometry, LAMP, MARK, WHITE, type LightUpPuzzle, type LightUpState } from "./logic";

type Tool = "lamp" | "x";
/** Cell gap and board padding: 2 and 6 px, tightened to 1 and 3 px on 10 × 10 so its cells stay large on phones. */
const gapFor = (n: number) => (n >= 10 ? 1 : 2);
const padFor = (n: number) => (n >= 10 ? 3 : 6);
/** White cells sit clearly lighter than the board and the black cells in both themes; lit ones take a gold wash. */
const WHITE_FILL = "color-mix(in srgb, var(--text) 16%, var(--surface))";
const LIT_FILL = "color-mix(in srgb, var(--gold) 34%, var(--surface))";

/**
 * Light Up board. Tap a white cell: lamp, then X, then clear (or place the chosen tool's mark). Lit cells
 * glow and carry a light beam along the row or column it comes from, so lit never relies on colour alone.
 * Lamps that see each other and over-full numbers shake, ring red and hatch.
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
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const cellsRef = useRef(cells);
  const streak = useRef(0);
  const gap = gapFor(n);
  const pad = padFor(n);
  // 44 px cells where they fit; a 10 × 10 board may use the shell's board padding (36 px at 375 wide, 30 at 320).
  const cell = fitCell(useViewportWidth(), n, gap * (n - 1) + pad * 2, 44, 56);
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
        play("jingle");
        api.feedback(T.cleared, "success", "check-circle");
        api.announce(T.cleared);
      } else {
        if (value === LAMP) streak.current++;
        play("pop", { step: Math.max(1, streak.current) });
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

  useEffect(() => {
    api.setControls([
      { id: "undo", label: T.controls.undo, icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
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
  }, [api, undo, hist.length, done, tool]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? T.tutorial : T.start(0), "info", "lightbulb-filament");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, cycle);

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
      <div
        role="grid"
        aria-label={T.board(n)}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={keys.onKeyDown}
        className="grid rounded-[16px]"
        style={{
          gridTemplateColumns: `repeat(${n}, ${cell}px)`,
          gap,
          padding: pad,
          background: "var(--board-bg)",
          boxShadow: "0 0 0 2px var(--line)",
          perspective: 600,
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
              const anim = done ? "" : i === last ? (bad ? shakeClass(shakeN) : popClass(tapN)) : "";
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
                    onClick={() => keys.setFocus(i)}
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
                  onClick={() => {
                    keys.setFocus(i);
                    cycle(i);
                  }}
                  onFocus={() => keys.setFocus(i)}
                  className={`relative flex cursor-pointer items-center justify-center overflow-hidden rounded-[6px] outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    background: v === LAMP ? "var(--gold)" : lit ? LIT_FILL : WHITE_FILL,
                    color: v === LAMP ? "var(--square-ink)" : "var(--text-muted)",
                    boxShadow: glow ? "inset 0 0 0 3px var(--accent)" : bad ? "inset 0 0 0 3px var(--danger)" : undefined,
                    transition: "background-color 120ms var(--ease-out)",
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
  );
}
