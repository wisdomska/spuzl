"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { CROWNFALL_COPY } from "@/lib/copy/crownfall";
import { analyze, CROWN, EMPTY, MARK, type CrownfallPuzzle, type CrownfallState } from "./logic";
import { PatternsOffer } from "./PatternsOffer";

type Tool = "crown" | "x";
/** Region edge (each side of a boundary, so a boundary reads 4 px) and the hairline inside a region. */
const EDGE = 2;
const EDGE_COLOUR = "var(--text)";
const HAIRLINE = "color-mix(in srgb, var(--text) 18%, transparent)";
const CORNER = 10;

/**
 * Crownfall board (Game Boards: Crownfall states). Tap cycles empty → X → crown (prototype `tap()`),
 * or with a tool selected, places that mark. Drag paints X. Rule breaks shake, hatch and ring the
 * offending cells; the clear wave flips cells to world colour from the last move.
 *
 * Cells touch (no gaps). Every side that faces another region or the board edge gets a thick line in
 * var(--text), so region shapes never rely on colour alone; the palette keeps >= 4.5:1 against it.
 */
export default function CrownfallBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<CrownfallPuzzle, CrownfallState>) {
  const n = puzzle.size;
  const [cells, setCells] = useState<CrownfallState>(() => initialState?.slice() ?? new Array(n * n).fill(EMPTY));
  const [hist, setHist] = useState<CrownfallState[]>([]);
  const [tool, setTool] = useState<Tool | null>(null);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const cellsRef = useRef(cells);
  const painting = useRef<null | { value: number }>(null);
  const cell = useCellSize(n, 0, 6, n <= 4 ? 72 : 64);
  const a = analyze(puzzle, cells);

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
      const broke = after.bad.size > before.bad.size;
      setCells(next);
      setHist((h) => [...h, prev]);
      setLast(i);
      setTapN((t) => t + 1);
      const r = Math.floor(i / n) + 1,
        c = (i % n) + 1;
      const markName = value === CROWN ? "crown" : value === MARK ? "marked empty" : "empty";
      if (broke) {
        streak.current = 0;
        setShakeN((s) => s + 1);
        api.ruleBreak(after.message);
        api.announce(`Row ${r}, column ${c}, ${markName}. ${after.message}`);
      } else if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback("Clean. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
      } else {
        if (value === CROWN) streak.current++;
        play("pop", { step: streak.current });
        api.announce(CROWNFALL_COPY.cellLabel(r - 1, c - 1, CROWNFALL_COPY.regionName(puzzle.regions[i]), markName));
        if (after.bad.size === 0) {
          const tip = mode === "tutorial" && after.crowns === n - 1 ? "One spot left that breaks no rule. Find the glow." : null;
          api.feedback(tip ?? `${after.crowns} of ${n} crowns`, "info", tip ? "hand-pointing" : "crown-simple");
        }
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    [api, disabled, done, mode, n, puzzle],
  );

  const cycle = useCallback(
    (i: number) => {
      const v = cells[i];
      const next = tool === "crown" ? (v === CROWN ? EMPTY : CROWN) : tool === "x" ? (v === MARK ? EMPTY : MARK) : (v + 1) % 3;
      commit(i, next);
    },
    [cells, commit, tool],
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

  // Controls row (design: Undo · Crown · Mark X · Hint)
  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      {
        id: "crown",
        label: "Crown",
        icon: "crown-simple",
        onPress: () => setTool((t) => (t === "crown" ? null : "crown")),
        active: tool === "crown",
      },
      { id: "x", label: "Mark X", icon: "x", onPress: () => setTool((t) => (t === "x" ? null : "x")), active: tool === "x" },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done, tool]);

  useEffect(() => {
    if (mode === "tutorial") api.feedback("Tap once for X, twice for a crown.", "info", "hand-pointing");
    else api.feedback(`0 of ${n} crowns`, "info", "crown-simple");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, cycle);

  // Drag paints X across cells (only from an empty or X cell, like the design note).
  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    if (disabled || done) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (tool !== "crown" && (cells[i] === EMPTY || cells[i] === MARK) && tool === "x")
      painting.current = { value: cells[i] === MARK ? EMPTY : MARK };
  };
  const onPointerEnter = (i: number) => () => {
    if (painting.current && cells[i] !== CROWN) commit(i, painting.current.value);
  };
  useEffect(() => {
    const up = () => (painting.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const lastR = Math.floor(last / n),
    lastC = last % n;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const tutorialGlow = mode === "tutorial" && !done && a.crowns === n - 1 && a.bad.size === 0;

  const T = CROWNFALL_COPY;
  const regionAt = (r: number, c: number) => (r < 0 || c < 0 || r >= n || c >= n ? -1 : puzzle.regions[r * n + c]);
  const cornerRadius = (r: number, c: number) => {
    const at = (rr: number, cc: number) => (r === rr && c === cc ? CORNER : 0);
    return {
      borderTopLeftRadius: at(0, 0),
      borderTopRightRadius: at(0, n - 1),
      borderBottomLeftRadius: at(n - 1, 0),
      borderBottomRightRadius: at(n - 1, n - 1),
    };
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className={`max-w-full overflow-x-auto ${done ? "board-pulse" : ""}`}>
        <div
          role="grid"
          aria-label={`Crownfall board, ${n} by ${n}`}
          aria-rowcount={n}
          aria-colcount={n}
          onKeyDown={keys.onKeyDown}
          className="grid rounded-[16px] p-1.5"
          style={{
            gridTemplateColumns: `repeat(${n}, ${cell}px)`,
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
                const reg = puzzle.regions[i];
                const bad = a.bad.has(i);
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                let anim = "";
                if (done) anim = "";
                else if (bad && i === last) anim = shakeN % 2 ? "cell-shake-a" : "cell-shake-b";
                else if (i === last) anim = tapN % 2 ? "cell-pop-a" : "cell-pop-b";
                const glow = (tutorialGlow && v !== CROWN && isSafeCrown(puzzle, cells, i)) || i === hintTarget;
                const fg = bad ? "var(--danger)" : v === MARK ? "#8A8EB0" : "var(--text)";
                const radius = cornerRadius(r, c);
                // Thick edge where the neighbour is another region or the board edge; a hairline inside a region
                // (drawn on the right and bottom only, so it is never doubled).
                const top = regionAt(r - 1, c) !== reg;
                const left = regionAt(r, c - 1) !== reg;
                const right = regionAt(r, c + 1) !== reg;
                const bottom = regionAt(r + 1, c) !== reg;
                const state = v === CROWN ? T.cellState.crown : v === MARK ? T.cellState.mark : T.cellState.empty;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    data-region={reg}
                    data-edges={`${+top}${+right}${+bottom}${+left}`}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-label={T.cellLabel(r, c, T.regionName(reg), state) + (bad ? T.cellState.bad : "")}
                    aria-selected={v === CROWN}
                    onClick={() => {
                      keys.setFocus(i);
                      cycle(i);
                    }}
                    onPointerDown={onPointerDown(i)}
                    onPointerEnter={onPointerEnter(i)}
                    className={`relative flex cursor-pointer items-center justify-center outline-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      backgroundColor: `var(--reg-${reg})`,
                      color: fg,
                      boxShadow: glow ? "inset 0 0 0 6px var(--accent)" : bad ? "inset 0 0 0 5px var(--danger)" : undefined,
                      fontSize: Math.round(cell / 2),
                      ...radius,
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        ...radius,
                        borderStyle: "solid",
                        borderTopWidth: top ? EDGE : 0,
                        borderLeftWidth: left ? EDGE : 0,
                        borderRightWidth: right ? EDGE : 1,
                        borderBottomWidth: bottom ? EDGE : 1,
                        borderTopColor: EDGE_COLOUR,
                        borderLeftColor: EDGE_COLOUR,
                        borderRightColor: right ? EDGE_COLOUR : HAIRLINE,
                        borderBottomColor: bottom ? EDGE_COLOUR : HAIRLINE,
                      }}
                    />
                    {done && (
                      <span
                        aria-hidden
                        className="absolute inset-0"
                        style={{
                          ...radius,
                          background: v === CROWN ? "var(--gold)" : "var(--world)",
                          animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both, fade-in 1ms linear ${dist * 70 + 250}ms both`,
                        }}
                      />
                    )}
                    {bad && <span aria-hidden className="hatch absolute inset-0" style={radius} />}
                    {v === CROWN && (
                      <Icon
                        name="crown-simple"
                        size={Math.round(cell * 0.5)}
                        className="relative"
                        style={done ? { color: "#0E0F1A" } : undefined}
                      />
                    )}
                    {v === MARK && !done && <Icon name="x" size={Math.round(cell * 0.45)} className="relative" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {mode !== "tutorial" && <PatternsOffer onAccepted={(text) => api.announce(text)} />}
    </div>
  );
}

function isSafeCrown(p: CrownfallPuzzle, cells: CrownfallState, i: number) {
  const next = cells.slice();
  next[i] = CROWN;
  return analyze(p, next).clear;
}
