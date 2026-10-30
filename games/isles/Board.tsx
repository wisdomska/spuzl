"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useFitCell } from "@/games/_shared/useFitCell";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { LineStyles } from "@/games/_shared/LineStyles";
import { analyze, crossings, edgeCells, RULE_COPY, type IslesPuzzle, type IslesState } from "./logic";

const GAP = 3;
const PAD = 6;
const INK = "#0E0F1A";

/**
 * Isles board. Tap an island, then an island in line with it, to cycle 0, 1, 2 bridges (or drag from
 * one to the other). Tap a bridge to cycle it too. Islands fill with the world colour when their
 * number is met; over-full islands get the danger ring and hatch. Keyboard: arrows move, Space or
 * Enter picks an island, then picks the second one.
 */
export default function IslesBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<IslesPuzzle, IslesState>) {
  const { rows, cols, islands, edges } = puzzle;
  const cross = useMemo(() => crossings(puzzle), [puzzle]);
  const islandAt = useMemo(() => new Map(islands.map((x, i) => [x.r * cols + x.c, i])), [islands, cols]);
  const pathOf = useMemo(() => edges.map((e) => edgeCells(puzzle, e)), [edges, puzzle]);
  const [state, setState] = useState<IslesState>(() => (initialState?.length === edges.length ? initialState.slice() : new Array(edges.length).fill(0)));
  const stateRef = useRef(state);
  const [hist, setHist] = useState<IslesState[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [origin, setOrigin] = useState<Record<number, number>>({});
  const [last, setLast] = useState(0);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [badIsland, setBadIsland] = useState(-1);
  const a = analyze(puzzle, state, cross);
  const [done, setDone] = useState(a.complete);
  const downAt = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { cs, bleed } = useFitCell(cols, GAP, PAD);
  const pitch = cs + GAP;
  const center = (i: number) => ({ x: PAD + islands[i].c * pitch + cs / 2, y: PAD + islands[i].r * pitch + cs / 2 });
  const where = (i: number) => `row ${islands[i].r + 1}, column ${islands[i].c + 1}`;

  const cycle = useCallback(
    (k: number, from: number) => {
      if (disabled || done) return;
      const prev = stateRef.current;
      const v = (prev[k] + 1) % 3;
      if (v > 0 && cross[k].some((j) => prev[j] > 0)) {
        setBadIsland(from);
        setShakeN((s) => s + 1);
        api.ruleBreak(RULE_COPY.cross);
        api.onMove(prev, { mistake: true });
        return;
      }
      const next = prev.slice();
      next[k] = v;
      stateRef.current = next;
      setState(next);
      setHist((h) => [...h, prev]);
      setOrigin((o) => ({ ...o, [k]: from }));
      const [x, y] = edges[k];
      const other = x === from ? y : x;
      setLast(other);
      setTapN((t) => t + 1);
      const after = analyze(puzzle, next, cross);
      const words = v === 0 ? "No bridges" : v === 1 ? "One bridge" : "Two bridges";
      api.announce(`${words} between ${where(x)} and ${where(y)}.`);
      if (after.complete) {
        setDone(true);
        play("jingle");
        api.feedback("Every island joined.", "success", "check-circle");
        api.announce("Board cleared.");
        api.onMove(next, { correctStreak: next.reduce((s, b) => s + b, 0) });
        api.onSolved(next);
        return;
      }
      const overNow = [x, y].find((i) => after.over.has(i) && !analyze(puzzle, prev, cross).over.has(i));
      if (overNow !== undefined) {
        setBadIsland(overNow);
        setShakeN((s) => s + 1);
        api.ruleBreak(RULE_COPY.over);
        api.onMove(next, { mistake: true });
        return;
      }
      setBadIsland(-1);
      play("synth", { step: next.reduce((s, b) => s + b, 0), silentHaptic: true });
      const met = islands.filter((isl, i) => after.count[i] === isl.n).length;
      api.feedback(`${met} of ${islands.length} islands complete`, "info", "circles-three");
      api.onMove(next, { correctStreak: met });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, cross, disabled, done, edges, islands, puzzle],
  );

  const edgeBetween = (i: number, j: number) => edges.findIndex(([x, y]) => (x === i && y === j) || (x === j && y === i));

  /** Tap or Space on a cell: pick islands, or cycle the bridge under a water cell. */
  const tapCell = useCallback(
    (cell: number) => {
      if (disabled || done) return;
      const i = islandAt.get(cell);
      if (i === undefined) {
        const cur = stateRef.current;
        const k = pathOf.findIndex((p, e) => cur[e] > 0 && p.includes(cell));
        if (k >= 0) cycle(k, edges[k][0]);
        else setSel(null);
        return;
      }
      if (sel === null || sel === i) {
        setSel(sel === i ? null : i);
        if (sel !== i) {
          api.feedback("Now tap an island in line with it.", "info", "hand-pointing");
          api.announce(`Picked island ${where(i)}, number ${islands[i].n}.`);
        }
        return;
      }
      const k = edgeBetween(sel, i);
      if (k < 0) {
        api.feedback("Those islands do not line up with a clear path.", "info", "hand-pointing");
        setSel(i);
        return;
      }
      setSel(null);
      cycle(k, sel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, cycle, disabled, done, edges, islandAt, islands, pathOf, sel],
  );

  const cellAt = (e: React.PointerEvent) => {
    const b = gridRef.current?.getBoundingClientRect();
    if (!b) return -1;
    const c = Math.floor((e.clientX - b.left - PAD) / pitch), r = Math.floor((e.clientY - b.top - PAD) / pitch);
    return r < 0 || c < 0 || r >= rows || c >= cols ? -1 : r * cols + c;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    const cell = cellAt(e);
    // no explicit pointer capture: the cell keeps its click for taps; drags are read from coordinates
    downAt.current = islandAt.has(cell) ? cell : null;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = downAt.current;
    downAt.current = null;
    if (start === null) return;
    const end = cellAt(e);
    const i = islandAt.get(start)!, j = end >= 0 ? islandAt.get(end) : undefined;
    // a drag between two islands builds directly; a tap falls through to onClick
    if (j !== undefined && j !== i) {
      e.preventDefault();
      dragged.current = true;
      const k = edgeBetween(i, j);
      if (k >= 0) {
        setSel(null);
        cycle(k, i);
      } else api.feedback("Those islands do not line up with a clear path.", "info", "hand-pointing");
    }
  };
  const dragged = useRef(false);

  const undo = useCallback(() => {
    if (done || !hist.length) return;
    const prev = hist[hist.length - 1];
    stateRef.current = prev;
    setState(prev);
    setHist((h) => h.slice(0, -1));
    setSel(null);
    setBadIsland(-1);
    api.onMove(prev);
  }, [api, done, hist]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done]);

  useEffect(() => {
    if (done) return;
    api.feedback(mode === "tutorial" ? "Tap an island, then one in line with it. Tap again for a second bridge." : "Tap two islands in line to build a bridge.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(rows, cols, tapCell);
  const hintEdge = typeof hint?.target === "number" ? edges[hint.target] : undefined;
  const lr = islands[last]?.r ?? 0, lc = islands[last]?.c ?? 0;
  const t = Math.max(4, Math.round(cs * 0.08));
  const d = Math.round(cs * 0.8);

  const bridges = edges.flatMap(([x, y], k) => {
    const v = state[k];
    if (!v) return [];
    const A = center(x), B = center(y);
    const horiz = A.y === B.y;
    const from = origin[k] ?? x;
    const forward = from === x;
    const span = horiz ? Math.abs(B.x - A.x) - d : Math.abs(B.y - A.y) - d;
    const offs = v === 1 ? [0] : [-(t + 2), t + 2];
    return offs.map((o, n) => (
      <div
        key={`${k}:${v}:${n}`}
        className={`absolute ${horiz ? "ll-grow-x" : "ll-grow-y"} ${a.crossed.has(k) ? "" : "ll-ink"}`}
        style={{
          left: horiz ? Math.min(A.x, B.x) + d / 2 : A.x - t / 2 + o,
          top: horiz ? A.y - t / 2 + o : Math.min(A.y, B.y) + d / 2,
          width: horiz ? span : t,
          height: horiz ? t : span,
          borderRadius: t,
          background: a.crossed.has(k) ? "var(--danger)" : undefined,
          transformOrigin: horiz ? (forward === A.x < B.x ? "0 50%" : "100% 50%") : forward === A.y < B.y ? "50% 0" : "50% 100%",
        }}
      />
    ));
  });

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ marginInline: -bleed, maxWidth: `calc(100% + ${bleed * 2}px)` }}>
      <LineStyles />
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Isles board, ${rows} by ${cols}, ${islands.length} islands`}
        aria-rowcount={rows}
        aria-colcount={cols}
        onKeyDown={keys.onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className={`relative grid rounded-[16px] select-none ${cols > 8 ? "" : "touch-none"}`}
        style={{ gridTemplateColumns: `repeat(${cols}, ${cs}px)`, gap: GAP, padding: PAD, background: "var(--board-bg)", perspective: 600 }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {bridges}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: cols }, (_, c) => {
              const cell = r * cols + c;
              const i = islandAt.get(cell);
              const onClick = () => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                keys.setFocus(cell);
                tapCell(cell);
              };
              if (i === undefined) {
                const k = pathOf.findIndex((p, e) => state[e] > 0 && p.includes(cell));
                return (
                  <div
                    key={cell}
                    role="gridcell"
                    data-i={cell}
                    tabIndex={keys.focus === cell ? 0 : -1}
                    aria-label={`Row ${r + 1}, column ${c + 1}, ${k >= 0 ? `${state[k] === 2 ? "double" : "single"} bridge` : "water"}`}
                    onClick={onClick}
                    className="relative flex items-center justify-center rounded-[8px] outline-none focus-visible:shadow-[var(--focus-ring)]"
                    style={{ width: cs, height: cs }}
                  >
                    {k < 0 && <span aria-hidden className="rounded-full" style={{ width: 4, height: 4, background: "var(--line)" }} />}
                  </div>
                );
              }
              const isl = islands[i];
              const have = a.count[i];
              const met = have === isl.n;
              const over = a.over.has(i);
              const picked = sel === i;
              const glow = hintEdge !== undefined && (hintEdge[0] === i || hintEdge[1] === i);
              const dist = Math.abs(r - lr) + Math.abs(c - lc);
              const anim = badIsland === i ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : i === last && !done ? (tapN % 2 ? "cell-pop-a" : "cell-pop-b") : "";
              return (
                <div
                  key={cell}
                  role="gridcell"
                  data-i={cell}
                  tabIndex={keys.focus === cell ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}, island ${isl.n}, ${have} bridge${have === 1 ? "" : "s"}${over ? ", too many" : met ? ", complete" : ""}${picked ? ", picked" : ""}`}
                  aria-selected={picked}
                  onClick={onClick}
                  className="relative z-[1] flex cursor-pointer items-center justify-center rounded-full outline-none focus-visible:shadow-[var(--focus-ring)]"
                  style={{ width: cs, height: cs }}
                >
                  <span
                    className={`num relative flex items-center justify-center overflow-hidden rounded-full font-bold ${anim} ${glow ? "hint-ring" : ""}`}
                    style={{
                      width: d,
                      height: d,
                      fontSize: Math.round(cs * 0.38),
                      background: met || done ? "var(--world)" : "var(--surface-raised)",
                      color: met || done ? INK : over ? "var(--danger)" : "var(--text)",
                      boxShadow: glow ? "0 0 0 4px var(--accent)" : over ? "inset 0 0 0 3px var(--danger)" : picked ? "0 0 0 3px var(--accent)" : met ? "none" : "inset 0 0 0 2px var(--line)",
                    }}
                  >
                    {done && <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: "var(--world)", animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both` }} />}
                    {over && <span aria-hidden className="hatch absolute inset-0" />}
                    <span className="relative">{isl.n}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
