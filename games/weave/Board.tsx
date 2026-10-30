"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { adjacent, dirBetween, edgeKey, step } from "@/games/_shared/grid";
import { LineStyles } from "@/games/_shared/LineStyles";
import { checkPath, maxClue, nextClue, RULE_COPY, stepError, wallSet, type WeavePuzzle, type WeaveState } from "./logic";

const GAP = 3;
const PAD = 6;
const INK = "#0E0F1A";

interface Trail {
  id: number;
  a: number;
  b: number;
}

/**
 * Weave board (Game Boards: Weave). Drag from 1 to draw; the glowing head follows the finger and
 * dragging back undoes. Tap a cell on the path to cut back to it. Keyboard: arrows move focus,
 * Space or Enter extends the path to the focused cell (or cuts back to it).
 */
export default function WeaveBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<WeavePuzzle, WeaveState>) {
  const n = puzzle.size;
  const N = n * n;
  const top = maxClue(puzzle);
  const walls = useRef(wallSet(puzzle)).current;
  const [path, setPath] = useState<WeaveState>(() => (initialState && checkPath(puzzle, initialState).valid ? initialState.slice() : []));
  const pathRef = useRef(path);
  const [bad, setBad] = useState(-1);
  const [shakeN, setShakeN] = useState(0);
  const [trail, setTrail] = useState<Trail[]>([]);
  const [done, setDone] = useState(() => checkPath(puzzle, path).complete);
  const trailId = useRef(0);
  const drag = useRef<{ last: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cs = useCellSize(n, GAP, PAD * 2 + 4);
  const pitch = cs + GAP;
  const th = Math.round(cs * 0.32);
  const center = (i: number) => ({ x: PAD + (i % n) * pitch + cs / 2, y: PAD + Math.floor(i / n) * pitch + cs / 2 });

  const fadeOut = useCallback((removed: number[], keep: number) => {
    // removed: cells cut from the end of the path; keep: the new head (or -1)
    const chain = keep >= 0 ? [keep, ...removed] : removed;
    const add: Trail[] = [];
    for (let k = 1; k < chain.length; k++) add.push({ id: ++trailId.current, a: chain[k - 1], b: chain[k] });
    if (!add.length) return;
    setTrail((t) => [...t, ...add]);
    const ids = new Set(add.map((x) => x.id));
    window.setTimeout(() => setTrail((t) => t.filter((x) => !ids.has(x.id))), 320);
  }, []);

  /** Commit a new path; reports the move, plays sound and checks for the clear. */
  const commit = useCallback(
    (next: WeaveState, focusCell: number) => {
      const prev = pathRef.current;
      pathRef.current = next;
      setPath(next);
      setBad(-1);
      if (next.length < prev.length) fadeOut(prev.slice(next.length), next.length ? next[next.length - 1] : -1);
      play("synth", { step: next.length, silentHaptic: true });
      const r = Math.floor(focusCell / n) + 1, c = (focusCell % n) + 1;
      const chk = checkPath(puzzle, next);
      if (chk.complete) {
        setDone(true);
        play("jingle");
        api.feedback("Woven. Every cell filled.", "success", "check-circle");
        api.announce("Board cleared.");
        api.onMove(next, { correctStreak: next.length });
        api.onSolved(next);
        return;
      }
      const num = puzzle.clues[focusCell];
      const reached = nextClue(puzzle, next) - 1;
      api.announce(`Row ${r}, column ${c}, ${num ? `number ${num}, ` : ""}path ${next.length} of ${N}`);
      if (next.length === 0) api.feedback("Drag from 1 to draw.", "info", "hand-pointing");
      else api.feedback(num && next.length > prev.length ? `Reached ${num} of ${top}` : `${next.length} of ${N} cells, next number ${reached + 1}`, "info", "path");
      api.onMove(next, { correctStreak: next.length });
    },
    [N, api, fadeOut, n, puzzle, top],
  );

  const breakRule = useCallback(
    (cell: number, why: keyof typeof RULE_COPY) => {
      setBad(cell);
      setShakeN((s) => s + 1);
      const msg = why === "order" ? `${RULE_COPY.order} Reach ${nextClue(puzzle, pathRef.current)} next.` : RULE_COPY[why];
      api.ruleBreak(msg);
      api.onMove(pathRef.current, { mistake: true });
    },
    [api, puzzle],
  );

  /** Try to move the head to `cell` (extend, or step back onto the path). Returns false on a rule break. */
  const reach = useCallback(
    (cell: number, fromDrag: boolean): boolean => {
      if (disabled || done || cell < 0) return false;
      const cur = pathRef.current;
      const k = cur.indexOf(cell);
      if (k >= 0) {
        if (k === cur.length - 1) return true;
        commit(cur.slice(0, k + 1), cell);
        return true;
      }
      if (cur.length === 0) {
        if (puzzle.clues[cell] === 1) {
          commit([cell], cell);
          return true;
        }
        if (!fromDrag) api.feedback("Start on 1.", "info", "hand-pointing");
        return false;
      }
      const head = cur[cur.length - 1];
      // a fast drag can skip cells along a row or column: walk there one cell at a time
      const hr = Math.floor(head / n), hc = head % n, tr = Math.floor(cell / n), tc = cell % n;
      if (!adjacent(n, head, cell) && (hr === tr || hc === tc)) {
        const d = dirBetween(n, head, hr === tr ? head + Math.sign(tc - hc) : head + Math.sign(tr - hr) * n);
        let next = cur;
        let at = head;
        while (at !== cell) {
          const to = step(n, n, at, d);
          const e = stepError(puzzle, next, to, walls, top);
          if (e) {
            if (next !== cur) commit(next, at);
            breakRule(to, e);
            return false;
          }
          next = [...next, to];
          at = to;
        }
        commit(next, cell);
        return true;
      }
      const e = stepError(puzzle, cur, cell, walls, top);
      if (e === "jump") {
        if (!fromDrag) api.feedback("Draw from the glowing head.", "info", "hand-pointing");
        return false;
      }
      if (e) {
        breakRule(cell, e);
        return false;
      }
      commit([...cur, cell], cell);
      return true;
    },
    [api, breakRule, commit, disabled, done, n, puzzle, top, walls],
  );

  const cellAt = (e: React.PointerEvent) => {
    const el = gridRef.current;
    if (!el) return -1;
    const b = el.getBoundingClientRect();
    const x = e.clientX - b.left - PAD, y = e.clientY - b.top - PAD;
    const c = Math.floor(x / pitch), r = Math.floor(y / pitch);
    if (r < 0 || c < 0 || r >= n || c >= n) return -1;
    // ignore the gap slivers so diagonal drags do not flicker between cells
    if (x - c * pitch > cs + 1 || y - r * pitch > cs + 1) return -1;
    return r * n + c;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || done) return;
    const i = cellAt(e);
    if (i < 0) return;
    gridRef.current?.setPointerCapture?.(e.pointerId);
    keys.setFocus(i);
    drag.current = { last: i };
    reach(i, false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const i = cellAt(e);
    if (i < 0 || i === drag.current.last) return;
    drag.current.last = i;
    reach(i, true);
  };
  const endDrag = () => (drag.current = null);

  const undo = useCallback(() => {
    const cur = pathRef.current;
    if (!cur.length || done) return;
    const next = cur.slice(0, -1);
    commit(next, next.length ? next[next.length - 1] : cur[0]);
  }, [commit, done]);
  const restart = useCallback(() => {
    if (!pathRef.current.length || done) return;
    commit([], pathRef.current[0]);
  }, [commit, done]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !path.length || done },
      { id: "restart", label: "Restart", icon: "arrow-clockwise", onPress: restart, disabled: !path.length || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, restart, path.length, done]);

  useEffect(() => {
    if (done) return;
    api.feedback(mode === "tutorial" ? "Drag from 1 through every cell. Numbers go in order." : "Drag from 1 to draw.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, (i) => reach(i, false));

  const head = path.length ? path[path.length - 1] : -1;
  const onPath = new Set(path);
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const hr = head >= 0 ? Math.floor(head / n) : 0, hc = head >= 0 ? head % n : 0;
  const boardPx = PAD * 2 + n * cs + (n - 1) * GAP;

  const bar = (a: number, b: number, className: string, key: string | number, color = "var(--world)") => {
    const A = center(a), B = center(b);
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
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "100%" }}>
      <LineStyles />
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Weave board, ${n} by ${n}`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={keys.onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative grid touch-none rounded-[16px] select-none"
        style={{ gridTemplateColumns: `repeat(${n}, ${cs}px)`, gap: GAP, padding: PAD, width: boardPx, background: "var(--board-bg)", perspective: 600 }}
      >
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const num = puzzle.clues[i];
              const lit = onPath.has(i);
              const isBad = bad === i;
              const glow = i === hintTarget;
              const dist = Math.abs(r - hr) + Math.abs(c - hc);
              const anim = isBad ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : "";
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}${num ? `, number ${num}` : ""}${lit ? `, path step ${path.indexOf(i) + 1}` : ", empty"}${i === head ? ", head" : ""}`}
                  aria-selected={lit}
                  className={`relative flex cursor-pointer items-center justify-center rounded-[8px] outline-none focus-visible:z-10 focus-visible:shadow-[var(--focus-ring)] ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{
                    width: cs,
                    height: cs,
                    background: lit ? "color-mix(in srgb, var(--world) 20%, var(--board-bg))" : "var(--surface-raised)",
                    boxShadow: glow ? "inset 0 0 0 4px var(--accent)" : isBad ? "inset 0 0 0 3px var(--danger)" : undefined,
                  }}
                >
                  {done && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[8px]"
                      style={{ background: "var(--world)", animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both, fade-in 1ms linear ${dist * 70 + 250}ms both` }}
                    />
                  )}
                  {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-[8px]" />}
                </div>
              );
            })}
          </div>
        ))}

        {/* Path layer: segments, trail, head, walls and numbers sit above the cells */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: done ? 0 : 1, transition: "opacity 300ms var(--ease-out) 400ms" }}>
          {path.slice(1).map((b, k) => bar(path[k], b, "ll-grow-@", `${k}:${path[k]}-${b}`))}
          {trail.map((t) => bar(t.a, t.b, "ll-trail", `t${t.id}`))}
          {head >= 0 && (
            <div
              className="ll-head absolute rounded-full"
              style={{ left: center(head).x - cs * 0.25, top: center(head).y - cs * 0.25, width: cs * 0.5, height: cs * 0.5, background: "var(--world)", boxShadow: "0 0 12px var(--world)" }}
            />
          )}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {puzzle.walls.map(([a, b]) => {
            const A = center(a);
            const horiz = Math.floor(a / n) === Math.floor(b / n);
            const w = 5;
            return (
              <div
                key={edgeKey(a, b)}
                className="absolute rounded-full"
                style={{
                  left: horiz ? A.x + cs / 2 + GAP / 2 - w / 2 : A.x - cs / 2 - 1,
                  top: horiz ? A.y - cs / 2 - 1 : A.y + cs / 2 + GAP / 2 - w / 2,
                  width: horiz ? w : cs + 2,
                  height: horiz ? cs + 2 : w,
                  background: "var(--text)",
                }}
              />
            );
          })}
          {puzzle.clues.map((num, i) => {
            if (!num) return null;
            const C = center(i);
            const lit = onPath.has(i);
            const d = Math.round(cs * 0.6);
            return (
              <span
                key={i}
                className="num absolute flex items-center justify-center rounded-full font-bold"
                style={{
                  left: C.x - d / 2,
                  top: C.y - d / 2,
                  width: d,
                  height: d,
                  fontSize: Math.round(cs * 0.32),
                  background: done ? INK : lit ? INK : "var(--text)",
                  color: done ? "var(--world)" : lit ? "var(--world)" : "var(--bg)",
                  transition: "background-color 120ms var(--ease-out)",
                }}
              >
                {num}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
