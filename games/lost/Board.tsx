"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { play } from "@/lib/audio";
import { BIT, DIR_NAME, step } from "@/games/_shared/grid";
import { LineStyles } from "@/games/_shared/LineStyles";
import { canMove, distances, replay, visibleFrom, type LostPuzzle, type LostState } from "./logic";

const VIEW = 7;
const PAD = 6;
const WALL = 4;
const INK = "#0E0F1A";
const KEY_DIR: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };

/**
 * Lost board. A 7 by 7 window onto the maze follows the player. Fog covers cells never seen, and
 * dims cells seen before but out of sight. Swipe (or keep dragging) to walk, tap a side of the
 * player to step that way, or use the arrow keys and WASD. Bumping a wall plays a bump and does not
 * count as a move.
 */
export default function LostBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<LostPuzzle, LostState>) {
  const { rows, cols } = puzzle;
  const toExit = useMemo(() => distances(puzzle, puzzle.exit), [puzzle]);
  const restored = useMemo(() => {
    const m = initialState?.moves ?? [];
    const r = replay(puzzle, m);
    return r.bad >= 0 ? { moves: [] as number[], path: [puzzle.start] } : { moves: m.slice(), path: r.path };
  }, [initialState, puzzle]);
  const [moves, setMoves] = useState<number[]>(restored.moves);
  const movesRef = useRef(moves);
  const [at, setAt] = useState(restored.path[restored.path.length - 1]);
  const atRef = useRef(at);
  const [seen, setSeen] = useState<Set<number>>(() => new Set(restored.path.flatMap((c) => visibleFrom(puzzle, c))));
  const [visited, setVisited] = useState<Set<number>>(() => new Set(restored.path));
  const [bumpN, setBumpN] = useState(0);
  const [done, setDone] = useState(at === puzzle.exit);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const cs = useCellSize(VIEW, 0, PAD * 2 + 4);
  const visible = useMemo(() => new Set(visibleFrom(puzzle, at)), [puzzle, at]);
  const rc = (i: number) => ({ r: Math.floor(i / cols), c: i % cols });
  const openDirs = (i: number) => [0, 1, 2, 3].filter((d) => canMove(puzzle, i, d)).map((d) => DIR_NAME[d]);

  const move = useCallback(
    (d: number) => {
      if (disabled || done) return;
      const cur = atRef.current;
      if (!canMove(puzzle, cur, d)) {
        setBumpN((b) => b + 1);
        play("bump");
        api.feedback("Wall. Try another way.", "info", "prohibit");
        api.announce(`Wall to the ${DIR_NAME[d]}.`);
        return;
      }
      const next = step(rows, cols, cur, d);
      const log = [...movesRef.current, d];
      movesRef.current = log;
      atRef.current = next;
      setMoves(log);
      setAt(next);
      setVisited((v) => new Set(v).add(next));
      setSeen((s) => {
        const out = new Set(s);
        for (const c of visibleFrom(puzzle, next)) out.add(c);
        return out;
      });
      const closer = 1 - toExit[next] / toExit[puzzle.start];
      play("synth", { step: Math.round(Math.max(0, closer) * 24), silentHaptic: true });
      const { r, c } = rc(next);
      if (next === puzzle.exit) {
        setDone(true);
        play("jingle");
        api.feedback("Out of the fog. You found the exit.", "success", "check-circle");
        api.announce("Exit reached. Board cleared.");
        api.onMove({ moves: log }, { correctStreak: log.length });
        api.onSolved({ moves: log });
        return;
      }
      api.announce(`Row ${r + 1}, column ${c + 1}. Open ${openDirs(next).join(", ")}.`);
      api.feedback(`${log.length} moves`, "info", "sneaker-move");
      api.onMove({ moves: log });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, cols, disabled, done, puzzle, rows, toExit],
  );

  useEffect(() => {
    api.setControls([
      { id: "left", label: "Left", icon: "arrow-left", onPress: () => move(3), disabled: done },
      { id: "up", label: "Up", icon: "arrow-up", onPress: () => move(0), disabled: done },
      { id: "down", label: "Down", icon: "arrow-down", onPress: () => move(2), disabled: done },
      { id: "right", label: "Right", icon: "arrow-right", onPress: () => move(1), disabled: done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, move, done]);

  useEffect(() => {
    if (done) return;
    api.feedback(mode === "tutorial" ? "Swipe or use the arrows. The fog lifts as you walk." : "Find the exit. Swipe to walk.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = KEY_DIR[e.key];
    if (d === undefined) return;
    e.preventDefault();
    move(d);
  };

  // swipe: every 0.6 cell of drag along the main axis is one step, so a long drag walks a corridor
  const onPointerDown = (e: React.PointerEvent) => {
    viewRef.current?.setPointerCapture?.(e.pointerId);
    swipe.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const th = cs * 0.6;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
    swipe.current = { x: e.clientX, y: e.clientY, moved: true };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.moved) return;
    // a tap steps toward the tapped side of the player
    const el = viewRef.current?.querySelector<HTMLElement>("[data-player]");
    const b = el?.getBoundingClientRect();
    if (!b) return;
    const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cs * 0.4) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
  };

  const { r: pr, c: pc } = rc(at);
  const span = VIEW * cs;
  const camX = Math.max(0, Math.min(cols * cs - span, pc * cs + cs / 2 - span / 2));
  const camY = Math.max(0, Math.min(rows * cs - span, pr * cs + cs / 2 - span / 2));
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const ex = rc(puzzle.exit);
  const wall = (closed: boolean, sides: number[], box: React.CSSProperties) => {
    if (!closed) return null;
    const near = sides.filter((x) => x >= 0);
    if (!done && !near.some((x) => seen.has(x))) return null;
    const lit = done || near.some((x) => visible.has(x));
    return <span aria-hidden className="ll-wall ll-fog absolute z-[3] rounded-full" style={{ ...box, opacity: lit ? 1 : 0.5 }} />;
  };

  return (
    <div className={done ? "board-pulse" : ""}>
      <LineStyles />
      <div
        ref={viewRef}
        role="grid"
        tabIndex={0}
        aria-label={`Lost maze, ${rows} by ${cols}. You are at row ${pr + 1}, column ${pc + 1}. Use the arrow keys to walk.`}
        aria-rowcount={rows}
        aria-colcount={cols}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
        className="relative touch-none overflow-hidden rounded-[16px] outline-none select-none focus-visible:shadow-[var(--focus-ring)]"
        style={{ width: span + PAD * 2, height: span + PAD * 2, padding: PAD, background: "var(--board-bg)" }}
      >
        <div className="relative overflow-hidden rounded-[10px]" style={{ width: span, height: span }}>
          <div className="ll-cam absolute top-0 left-0" style={{ width: cols * cs, height: rows * cs, transform: `translate(${-camX}px, ${-camY}px)`, perspective: 600 }}>
            {Array.from({ length: rows }, (_, r) => (
              <div role="row" key={r} className="contents">
                {Array.from({ length: cols }, (_, c) => {
                  const i = r * cols + c;
                  const m = puzzle.cells[i];
                  const isSeen = seen.has(i) || done;
                  const isVis = visible.has(i) || done;
                  const isExit = i === puzzle.exit;
                  const dist = Math.min(18, Math.abs(r - ex.r) + Math.abs(c - ex.c));
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label={isSeen ? `Row ${r + 1}, column ${c + 1}${isExit ? ", exit" : ""}${i === at ? ", you" : ""}` : `Row ${r + 1}, column ${c + 1}, fog`}
                      className={`absolute ${i === hintTarget ? "hint-ring" : ""}`}
                      style={{ left: c * cs, top: r * cs, width: cs, height: cs, background: isExit ? "var(--world)" : "var(--surface)" }}
                    >
                      {done && !isExit && (
                        <span
                          aria-hidden
                          className="absolute inset-0"
                          style={{ background: "color-mix(in srgb, var(--world) 30%, var(--surface))", animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both, fade-in 1ms linear ${dist * 70 + 250}ms both` }}
                        />
                      )}
                      {visited.has(i) && !isExit && <span aria-hidden className="absolute rounded-full" style={{ left: cs / 2 - 3, top: cs / 2 - 3, width: 6, height: 6, background: "color-mix(in srgb, var(--world) 45%, transparent)" }} />}
                      {isExit && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ color: INK }}>
                          <Icon name="door-open" size={Math.round(cs * 0.5)} />
                        </span>
                      )}
                      {i === puzzle.start && !isExit && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                          <Icon name="flag-pennant" size={Math.round(cs * 0.36)} />
                        </span>
                      )}
                      {i === hintTarget && <span aria-hidden className="absolute inset-1 rounded-[8px]" style={{ boxShadow: "inset 0 0 0 3px var(--accent)" }} />}
                      {/* walls sit above the fog, but only on edges that touch a seen cell, so the fog hides the rest */}
                      {wall(!(m & BIT[0]), [i, i - cols], { left: -WALL / 2, top: -WALL / 2, width: cs + WALL, height: WALL })}
                      {wall(!(m & BIT[3]), c > 0 ? [i, i - 1] : [i], { left: -WALL / 2, top: -WALL / 2, width: WALL, height: cs + WALL })}
                      {wall(r === rows - 1, [i], { left: -WALL / 2, top: cs - WALL / 2, width: cs + WALL, height: WALL })}
                      {wall(c === cols - 1, [i], { left: cs - WALL / 2, top: -WALL / 2, width: WALL, height: cs + WALL })}
                      <span
                        aria-hidden
                        className="ll-fog pointer-events-none absolute"
                        style={{ inset: 0, background: "var(--board-bg)", opacity: isVis ? 0 : isSeen ? 0.55 : 1, zIndex: 2 }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            <div
              data-player
              aria-hidden
              className="ll-cam absolute top-0 left-0 z-[4] flex items-center justify-center"
              style={{ width: cs, height: cs, transform: `translate(${pc * cs}px, ${pr * cs}px)` }}
            >
              {!done && <span className="ll-head absolute rounded-full" style={{ width: cs * 0.5, height: cs * 0.5, background: "var(--world)", opacity: 0.6 }} />}
              <span
                key={bumpN}
                className={`relative flex items-center justify-center rounded-full ${bumpN ? (bumpN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
                style={{ width: cs * 0.56, height: cs * 0.56, background: "var(--world)", color: INK, boxShadow: "0 0 14px var(--world)" }}
              >
                <Icon name="person-simple-walk" size={Math.round(cs * 0.36)} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
