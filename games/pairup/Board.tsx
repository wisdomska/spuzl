"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { adjacent } from "@/games/_shared/grid";
import { LineStyles } from "@/games/_shared/LineStyles";
import { useFitCell } from "@/games/_shared/useFitCell";
import { analyze, endpoints, type PairupPuzzle, type PairupState } from "./logic";

const GAP = 3;
const PAD = 6;
const INK = "#0E0F1A";
/** Pair colours: the world fills (all readable with ink text), then silver. Every pair also shows its number. */
const PAIR_COLORS = [
  "var(--w-line)",
  "var(--w-shape)",
  "var(--w-logic)",
  "var(--w-word)",
  "var(--w-number)",
  "var(--w-clue)",
  "var(--w-reflex)",
  "var(--w-board)",
  "var(--pos-2)",
];
const pairColor = (k: number) => PAIR_COLORS[k % PAIR_COLORS.length];

/**
 * Pairup board. Drag from a numbered dot to draw its line; drag back to undo; draw over another line to
 * cut it. Lines may not pass another pair's dot. Keyboard: arrows move, Space or Enter on a dot picks
 * its line, then on a neighbouring cell extends it (or on the line itself, cuts back to there).
 */
export default function PairupBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<PairupPuzzle, PairupState>) {
  const n = puzzle.size;
  const ends = useMemo(() => endpoints(puzzle), [puzzle]);
  const K = ends.length;
  const [lines, setLines] = useState<PairupState>(() =>
    initialState?.length === K && !analyze(puzzle, initialState).error ? initialState.map((l) => l.slice()) : ends.map(() => []),
  );
  const linesRef = useRef(lines);
  const [active, setActive] = useState<number | null>(null);
  const [hist, setHist] = useState<PairupState[]>([]);
  const [bad, setBad] = useState(-1);
  const [shakeN, setShakeN] = useState(0);
  const [trail, setTrail] = useState<{ id: number; a: number; b: number; k: number }[]>([]);
  const trailId = useRef(0);
  const drag = useRef<{ last: number; k: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const a = analyze(puzzle, lines);
  const [done, setDone] = useState(a.complete);
  const { cs, bleed } = useFitCell(n, GAP, PAD);
  const pitch = cs + GAP;
  const th = Math.round(cs * 0.3);
  const center = (i: number) => ({ x: PAD + (i % n) * pitch + cs / 2, y: PAD + Math.floor(i / n) * pitch + cs / 2 });
  const rc = (i: number) => `row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;

  const fade = useCallback((removed: { line: number[]; k: number }[]) => {
    const add = removed.flatMap(({ line, k }) => line.slice(1).map((b, s) => ({ id: ++trailId.current, a: line[s], b, k })));
    if (!add.length) return;
    setTrail((t) => [...t, ...add]);
    const ids = new Set(add.map((x) => x.id));
    window.setTimeout(() => setTrail((t) => t.filter((x) => !ids.has(x.id))), 320);
  }, []);

  /** Set new lines, report the move, play the line sound and check for a clear. */
  const commit = useCallback(
    (next: PairupState, k: number, cell: number, record = true) => {
      const prev = linesRef.current;
      if (record) setHist((h) => [...h.slice(-60), prev]);
      // trail for whatever got shorter
      fade(prev.flatMap((l, j) => (next[j].length < l.length ? [{ line: l.slice(Math.max(0, next[j].length - 1)), k: j }] : [])));
      linesRef.current = next;
      setLines(next);
      setBad(-1);
      const after = analyze(puzzle, next);
      const joined = after.connected.has(k + 1) && !analyze(puzzle, prev).connected.has(k + 1);
      play("synth", { step: after.filled - 2 * K + (joined ? 6 : 0), silentHaptic: true });
      if (after.complete) {
        setDone(true);
        setActive(null);
        drag.current = null;
        play("jingle");
        api.feedback("Every pair joined, every cell filled.", "success", "check-circle");
        api.announce("Board cleared.");
        api.onMove(next, { correctStreak: after.connected.size });
        api.onSolved(next);
        return;
      }
      api.announce(`Line ${k + 1}, ${rc(cell)}${joined ? ", joined" : ""}.`);
      if (after.connected.size === K) api.feedback("All pairs joined. Now fill every cell.", "info", "squares-four");
      else api.feedback(`${after.connected.size} of ${K} pairs joined`, "info", "link-simple");
      api.onMove(next, { correctStreak: after.connected.size });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [K, api, fade, puzzle],
  );

  const breakRule = useCallback(
    (cell: number, msg: string) => {
      setBad(cell);
      setShakeN((s) => s + 1);
      api.ruleBreak(msg);
      api.onMove(linesRef.current, { mistake: true });
    },
    [api],
  );

  /** Start (or restart) drawing at a cell: a dot starts its line fresh, a line cell cuts back to it. */
  const begin = useCallback(
    (cell: number, record: boolean): number | null => {
      if (disabled || done) return null;
      const dot = puzzle.dots[cell];
      const cur = linesRef.current;
      if (dot) {
        const k = dot - 1;
        const l = cur[k];
        // tapping the start dot of a finished or partial line keeps it; the far dot restarts from there
        if (l.length && l[0] === cell) {
          if (l.length > 1)
            commit(
              cur.map((x, j) => (j === k ? [cell] : x)),
              k,
              cell,
              record,
            );
        } else
          commit(
            cur.map((x, j) => (j === k ? [cell] : x)),
            k,
            cell,
            record,
          );
        setActive(k);
        return k;
      }
      const k = cur.findIndex((l) => l.includes(cell));
      if (k < 0) {
        api.feedback("Start from a numbered dot.", "info", "hand-pointing");
        return null;
      }
      const l = cur[k];
      const at = l.indexOf(cell);
      if (at < l.length - 1)
        commit(
          cur.map((x, j) => (j === k ? l.slice(0, at + 1) : x)),
          k,
          cell,
          record,
        );
      setActive(k);
      return k;
    },
    [api, commit, disabled, done, puzzle.dots],
  );

  /** Extend line k into `cell` (or back up along it). */
  const extend = useCallback(
    (k: number, cell: number, fromDrag: boolean) => {
      if (disabled || done) return;
      const cur = linesRef.current;
      const l = cur[k];
      if (!l.length) return;
      const at = l.indexOf(cell);
      if (at >= 0) {
        if (at < l.length - 1)
          commit(
            cur.map((x, j) => (j === k ? l.slice(0, at + 1) : x)),
            k,
            cell,
            !fromDrag,
          );
        return;
      }
      const head = l[l.length - 1];
      if (!adjacent(n, head, cell)) {
        if (!fromDrag) api.feedback("Draw one cell at a time from the line's end.", "info", "hand-pointing");
        return;
      }
      const [d0, d1] = ends[k];
      const goal = l[0] === d0 ? d1 : d0;
      if (head === goal && l.length > 1) return; // already joined; back up to change it
      const dot = puzzle.dots[cell];
      if (dot && dot !== k + 1) {
        breakRule(cell, `Lines cannot pass dot ${dot}.`);
        return;
      }
      // drawing over another line cuts that line back to just before this cell
      const next = cur.map((x, j) => {
        if (j === k) return [...l, cell];
        const p = x.indexOf(cell);
        return p >= 0 ? x.slice(0, p) : x;
      });
      commit(next, k, cell, !fromDrag);
    },
    [api, breakRule, commit, disabled, done, ends, n, puzzle.dots],
  );

  const cellAt = (e: React.PointerEvent) => {
    const b = gridRef.current?.getBoundingClientRect();
    if (!b) return -1;
    const x = e.clientX - b.left - PAD,
      y = e.clientY - b.top - PAD;
    const c = Math.floor(x / pitch),
      r = Math.floor(y / pitch);
    if (r < 0 || c < 0 || r >= n || c >= n) return -1;
    if (x - c * pitch > cs + 1 || y - r * pitch > cs + 1) return -1;
    return r * n + c;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    const cell = cellAt(e);
    if (cell < 0) return;
    keys.setFocus(cell);
    if (disabled || done) return;
    // one undo step per drag: snapshot now, then the drag's moves are not recorded separately
    setHist((h) => [...h.slice(-60), linesRef.current]);
    const k = begin(cell, false);
    if (k === null) return;
    gridRef.current?.setPointerCapture?.(e.pointerId);
    drag.current = { last: cell, k };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const cell = cellAt(e);
    if (cell < 0 || cell === d.last) return;
    d.last = cell;
    extend(d.k, cell, true);
  };
  const endDrag = () => (drag.current = null);

  const onKey = useCallback(
    (cell: number) => {
      if (puzzle.dots[cell] || active === null || linesRef.current[active].includes(cell)) {
        const cur = linesRef.current;
        if (active !== null && cur[active].includes(cell)) extend(active, cell, false);
        else begin(cell, true);
        return;
      }
      extend(active, cell, false);
    },
    [active, begin, extend, puzzle.dots],
  );
  const keys = useGridKeys(n, n, onKey);

  const undo = useCallback(() => {
    if (done || !hist.length) return;
    const prev = hist[hist.length - 1];
    setHist((h) => h.slice(0, -1));
    commit(prev, active ?? 0, prev[active ?? 0]?.[0] ?? 0, false);
  }, [active, commit, done, hist]);
  const restart = useCallback(() => {
    if (done) return;
    commit(
      ends.map(() => []),
      0,
      0,
    );
    setActive(null);
  }, [commit, done, ends]);

  useEffect(() => {
    const drawn = lines.some((l) => l.length > 1);
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "restart", label: "Restart", icon: "arrow-clockwise", onPress: restart, disabled: !drawn || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, restart, hist.length, done, lines]);

  useEffect(() => {
    if (done) return;
    api.feedback(
      mode === "tutorial" ? "Drag from a dot to its twin. Fill every cell." : "Drag from a dot to its twin.",
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const lastCell = (() => {
    const l = active !== null ? lines[active] : null;
    return l?.length ? l[l.length - 1] : ends[0][0];
  })();
  const lr = Math.floor(lastCell / n),
    lc = lastCell % n;

  const bar = (p: number, q: number, color: string, className: string, key: string | number) => {
    const A = center(p),
      B = center(q);
    const horiz = A.y === B.y;
    const forward = horiz ? B.x > A.x : B.y > A.y;
    const len = pitch + th;
    return (
      <div
        key={key}
        aria-hidden
        className={`absolute ${className.replace("@", horiz ? "x" : "y")}`}
        style={{
          left: Math.min(A.x, B.x) - th / 2,
          top: Math.min(A.y, B.y) - th / 2,
          width: horiz ? len : th,
          height: horiz ? th : len,
          borderRadius: th / 2,
          background: color,
          transformOrigin: horiz ? `${forward ? th / 2 : len - th / 2}px 50%` : `50% ${forward ? th / 2 : len - th / 2}px`,
        }}
      />
    );
  };

  return (
    <div
      className={`overflow-x-auto ${done ? "board-pulse" : ""}`}
      style={{ marginInline: -bleed, maxWidth: `calc(100% + ${bleed * 2}px)` }}
    >
      <LineStyles />
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Pairup board, ${n} by ${n}, ${K} pairs`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={keys.onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative grid touch-none rounded-[16px] select-none"
        style={{ gridTemplateColumns: `repeat(${n}, ${cs}px)`, gap: GAP, padding: PAD, background: "var(--board-bg)", perspective: 600 }}
      >
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const own = a.owner[i];
              const isBad = bad === i;
              const glow = i === hintTarget;
              const dist = Math.abs(r - lr) + Math.abs(c - lc);
              const dot = puzzle.dots[i];
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${dot ? `dot ${dot}` : own ? `line ${own}` : "empty"}${dot && a.connected.has(dot) ? ", joined" : ""}`}
                  aria-selected={own > 0 && !dot}
                  className={`relative cursor-pointer rounded-[8px] outline-none focus-visible:z-10 focus-visible:shadow-[var(--focus-ring)] ${isBad ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""} ${glow ? "hint-ring" : ""}`}
                  style={{
                    width: cs,
                    height: cs,
                    background: own && !dot ? `color-mix(in srgb, ${pairColor(own - 1)} 18%, var(--board-bg))` : "var(--surface-raised)",
                    boxShadow: glow ? "inset 0 0 0 4px var(--accent)" : isBad ? "inset 0 0 0 3px var(--danger)" : undefined,
                  }}
                >
                  {done && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[8px]"
                      style={{
                        background: pairColor(own - 1),
                        animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both, fade-in 1ms linear ${dist * 70 + 250}ms both`,
                      }}
                    />
                  )}
                  {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-[8px]" />}
                </div>
              );
            })}
          </div>
        ))}

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ opacity: done ? 0 : 1, transition: "opacity 300ms var(--ease-out) 400ms" }}
        >
          {lines.flatMap((l, k) => l.slice(1).map((q, s) => bar(l[s], q, pairColor(k), "ll-grow-@", `${k}:${s}:${l[s]}-${q}`)))}
          {trail.map((t) => bar(t.a, t.b, pairColor(t.k), "ll-trail", `t${t.id}`))}
          {active !== null && !done && lines[active].length > 0 && !a.connected.has(active + 1) && (
            <div
              className="ll-head absolute rounded-full"
              style={{
                left: center(lines[active][lines[active].length - 1]).x - cs * 0.2,
                top: center(lines[active][lines[active].length - 1]).y - cs * 0.2,
                width: cs * 0.4,
                height: cs * 0.4,
                background: pairColor(active),
              }}
            />
          )}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {puzzle.dots.map((dot, i) => {
            if (!dot) return null;
            const C = center(i);
            const d = Math.round(cs * 0.68);
            const joined = a.connected.has(dot);
            return (
              <span
                key={i}
                className="num absolute flex items-center justify-center rounded-full font-bold"
                style={{
                  left: C.x - d / 2,
                  top: C.y - d / 2,
                  width: d,
                  height: d,
                  fontSize: Math.round(cs * 0.36),
                  background: pairColor(dot - 1),
                  color: INK,
                  boxShadow: joined || done ? `0 0 0 3px ${INK}, 0 0 0 5px ${pairColor(dot - 1)}` : undefined,
                }}
              >
                {dot}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
