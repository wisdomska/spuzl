"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize, useFitHeight } from "@/components/game/useBoardSize";
import { cellCap, GRID_PAD } from "./size";
import { isKeyedInput, useGridKeys } from "@/components/game/useGridKeys";
import { sfx } from "@/games/_shared/sfx";
import { CROWNFALL_COPY } from "@/lib/copy/crownfall";
import { analyze, CROWN, EMPTY, MARK, type CrownfallPuzzle, type CrownfallState } from "./logic";
import { PatternsOffer } from "./PatternsOffer";
import { ShellAside } from "@/components/game/ShellAside";

type Tool = "crown" | "x";
const T = CROWNFALL_COPY;
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
  // Keyboard entry changes state without the pop (useGridKeys).
  const [quiet, setQuiet] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const cellsRef = useRef(cells);
  const painting = useRef<null | { value: number; n: number }>(null);
  // Whatever sits under the grid fits too: the cells step down until the shell does (short laptops and phones).
  const rootRef = useRef<HTMLDivElement>(null);
  // The grid pads 6 px on each side, so 12 px across and down are not cells (R3-02: counting one side left a wide
  // board 5 px past the viewport at 1280 × 800).
  const cell = useFitHeight(useCellSize(n, 0, GRID_PAD * 2, cellCap(n)), 36, n, rootRef, "shell");
  const a = analyze(puzzle, cells);

  const commit = useCallback(
    (i: number, value: number, painted = false) => {
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
      setQuiet(isKeyedInput());
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
        sfx.place(streak.current + 1);
        api.feedback(T.board.cleared, "success", "check-circle");
        api.announce(T.board.clearedShort);
      } else {
        if (value === CROWN) streak.current++;
        // A dragged X is texture under the finger; taking a mark off is soft; anything placed blips.
        if (painted) sfx.trace(painting.current ? painting.current.n++ : 0);
        else if (value === EMPTY) sfx.remove();
        else sfx.place(streak.current);
        api.announce(CROWNFALL_COPY.cellLabel(r - 1, c - 1, CROWNFALL_COPY.regionName(puzzle.regions[i]), markName));
        if (after.bad.size === 0) {
          const tip = mode === "tutorial" && after.crowns === n - 1 ? T.board.lastSpotTutorial : null;
          api.feedback(tip ?? T.board.crowns(after.crowns, n), "info", tip ? "hand-pointing" : "crown-simple");
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
    if (!hist.length || done) return;
    const prev = hist[hist.length - 1];
    cellsRef.current = prev;
    setCells(prev);
    setHist(hist.slice(0, -1));
    api.onMove(prev);
    // Say what the board holds now, so an undo is never silent (feedback line and screen reader).
    const placed = prev.filter((v) => v === CROWN).length;
    api.feedback(T.board.crowns(placed, n), "info", "crown-simple");
    api.announce(T.board.undone(placed, n));
  }, [api, done, hist, n]);

  // Start over: every mark off. It sits in the game menu (Restart), which asks first once the board has moves.
  const marked = cells.some((v) => v !== EMPTY);
  const restart = useCallback(() => {
    if (done || !cellsRef.current.some((v) => v !== EMPTY)) return;
    const empty = new Array<number>(n * n).fill(EMPTY);
    cellsRef.current = empty;
    setCells(empty);
    setHist([]);
    setLast(-1);
    streak.current = 0;
    api.onMove(empty);
    api.feedback(T.board.crowns(0, n), "info", "crown-simple");
    api.announce(T.board.restarted(n));
  }, [api, done, n]);

  // Controls row (design: Undo · Crown · Mark X · Hint); Restart goes to the game menu.
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
      { id: "restart", label: "Restart", icon: "arrow-clockwise", onPress: restart, disabled: !marked || done },
    ]);
  }, [api, undo, restart, marked, hist.length, done, tool]);

  useEffect(() => {
    if (mode === "tutorial") api.feedback(T.board.startTutorial, "info", "hand-pointing");
    else api.feedback(T.board.crowns(0, n), "info", "crown-simple");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, cycle);

  // Drag paints X across cells (only from an empty or X cell, like the design note).
  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    if (disabled || done) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (tool !== "crown" && (cells[i] === EMPTY || cells[i] === MARK) && tool === "x")
      painting.current = { value: cells[i] === MARK ? EMPTY : MARK, n: 0 };
  };
  const onPointerEnter = (i: number) => () => {
    if (painting.current && cells[i] !== CROWN) commit(i, painting.current.value, true);
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
    <div ref={rootRef} className="flex w-full flex-col items-center gap-3">
      <div className={`max-w-full overflow-x-auto ${done ? "board-pulse" : ""}`}>
        <div
          role="grid"
          aria-label={`Crownfall board, ${n} by ${n}`}
          aria-rowcount={n}
          aria-colcount={n}
          onKeyDown={keys.onKeyDown}
          className="grid rounded-[16px]"
          style={{
            gridTemplateColumns: `repeat(${n}, ${cell}px)`,
            padding: GRID_PAD,
            background: "var(--board-bg)",
            boxShadow: "0 0 0 2px var(--line)",
            perspective: 600,
            // With Mark X on, a drag paints X across cells: the page must not scroll or zoom under the finger.
            touchAction: tool === "x" && !done ? "none" : undefined,
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
                else if (i === last && !quiet) anim = tapN % 2 ? "cell-pop-a" : "cell-pop-b";
                const glow = (tutorialGlow && v !== CROWN && isSafeCrown(puzzle, cells, i)) || i === hintTarget;
                const fg = bad ? "var(--danger)" : v === MARK ? "var(--mark-x)" : "var(--text)";
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
                        style={done ? { color: "var(--on-gold)" } : undefined}
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
      {mode !== "tutorial" && (
        <ShellAside>
          <PatternsOffer onAccepted={(text) => api.announce(text)} />
        </ShellAside>
      )}
    </div>
  );
}

function isSafeCrown(p: CrownfallPuzzle, cells: CrownfallState, i: number) {
  const next = cells.slice();
  next[i] = CROWN;
  return analyze(p, next).clear;
}
