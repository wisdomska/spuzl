"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { quick } from "@/lib/copy/quick";
import { best, canMove, DIR_WORD, initialBoard, slide, total, type Dir, type MergePuzzle, type MergeState } from "./logic";

const GAP = 8;
const PAD = 8;
const INK = "#0E0F1A";
const t = quick.merge;
const KEY_DIR: Record<string, Dir> = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R", w: "U", s: "D", a: "L", d: "R" };

/** Tile fills climb through the world palette; the number is always printed, so colour is never alone. */
function look(v: number): { bg: string; fg: string } {
  const steps: Record<number, string> = {
    2: "var(--surface-raised)",
    4: "color-mix(in srgb, var(--w-number) 35%, var(--surface-raised))",
    8: "color-mix(in srgb, var(--w-number) 65%, var(--surface-raised))",
    16: "var(--w-number)",
    32: "var(--w-shape)",
    64: "var(--w-clue)",
    128: "var(--w-board)",
    256: "var(--w-logic)",
    512: "var(--w-reflex)",
    1024: "var(--w-line)",
    2048: "var(--w-word)",
  };
  const bg = steps[v] ?? "var(--accent)";
  return { bg, fg: v <= 4 ? "var(--text)" : INK };
}

interface Tile {
  id: number;
  v: number;
  at: number;
  /** "new" pops in, "merged" pops, "gone" slides under its partner and is removed next move */
  fx: "new" | "merged" | "gone" | "";
}

/**
 * Merge board: swipe or use the arrow keys. A 3 minute limit runs while the board is active (it pauses
 * with the game), shown as a draining bar in the card: the shell header holds the only clock. Time up
 * or no moves left ends the run and submits the move log.
 */
export default function MergeBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<MergePuzzle, MergeState>) {
  const n = puzzle.size;
  // Build the starting board (and replay any restored moves) once.
  const [boot] = useState(() => {
    const init = initialBoard(puzzle);
    let b = init.board;
    for (const [d] of initialState?.moves ?? []) {
      const st = slide(n, b, d);
      if (st.changed) b = init.spawn(st.board).board;
    }
    const t: Tile[] = b.flatMap((v, at) => (v ? [{ id: at, v, at, fx: "new" as const }] : []));
    return { engine: { board: b, spawn: init.spawn, moves: initialState?.moves.slice() ?? [], ids: n * n }, tiles: t, board: b };
  });
  const engine = useRef(boot.engine);
  const [tiles, setTiles] = useState<Tile[]>(boot.tiles);
  const [board, setBoard] = useState<number[]>(boot.board);
  const [elapsed, setElapsed] = useState(initialState?.moves.at(-1)?.[1] ?? 0);
  const [over, setOver] = useState<null | "time" | "stuck" | "done">(null);
  const [moveN, setMoveN] = useState(0);
  const clock = useRef({ base: initialState?.moves.at(-1)?.[1] ?? 0, since: 0, running: false });
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const on = () => setWidth(Math.min(358, window.innerWidth - 36));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const cell = Math.floor((width - PAD * 2 - GAP * (n - 1)) / n);
  const pitch = cell + GAP;

  const now = useCallback(
    () => (clock.current.running ? clock.current.base + performance.now() - clock.current.since : clock.current.base),
    [],
  );

  // Countdown: runs after the first move, pauses while disabled.
  const running = moveN > 0 && !disabled && !over;
  useEffect(() => {
    if (!running) return;
    const c = clock.current;
    c.since = performance.now();
    c.running = true;
    const id = setInterval(() => setElapsed(c.base + performance.now() - c.since), 200);
    return () => {
      c.base += performance.now() - c.since;
      c.running = false;
      clearInterval(id);
    };
  }, [running]);

  const finish = useCallback(
    (why: "time" | "stuck" | "done") => {
      const e = engine.current;
      if (!e || over) return;
      setOver(why);
      const b = e.board;
      const msg =
        why === "time"
          ? `Time. Best tile ${best(b)}, total ${total(b)}.`
          : why === "stuck"
            ? `No moves left. Best tile ${best(b)}.`
            : `Run banked. Best tile ${best(b)}.`;
      play("jingle");
      api.feedback(msg, "success", "trophy");
      api.announce(msg);
      api.onSolved({ moves: e.moves.slice() });
    },
    [api, over],
  );

  useEffect(() => {
    if (running && elapsed >= puzzle.limitMs) finish("time");
  }, [elapsed, finish, puzzle.limitMs, running]);

  const move = useCallback(
    (d: Dir) => {
      const e = engine.current;
      if (!e || disabled || over) return;
      const t = Math.round(Math.min(now(), puzzle.limitMs));
      const s = slide(n, e.board, d);
      if (!s.changed) {
        play("tick");
        api.announce(`Nothing moves ${DIR_WORD[d]}.`);
        return;
      }
      const sp = e.spawn(s.board);
      e.board = sp.board;
      e.moves.push([d, t]);
      // move tiles by their trail; merged pairs keep the moving tile on top, the other is dropped
      setTiles((prev) => {
        const byAt = new Map(prev.filter((x) => x.fx !== "gone").map((x) => [x.at, x]));
        const out: Tile[] = [];
        for (const tr of s.trail) {
          const tile = byAt.get(tr.from);
          if (!tile) continue;
          out.push({ ...tile, at: tr.to, fx: tr.merged ? "gone" : "" });
        }
        for (const at of s.mergedAt) {
          const keep = out.find((x) => x.at === at && x.fx !== "gone");
          if (keep) {
            keep.v = s.board[at];
            keep.fx = "merged";
          }
        }
        if (sp.at >= 0) out.push({ id: e.ids++, v: sp.board[sp.at], at: sp.at, fx: "new" });
        return out;
      });
      setBoard(sp.board);
      setMoveN((k) => k + 1);
      if (s.gained) play("pop", { step: Math.min(7, Math.log2(Math.max(...s.mergedAt.map((i) => s.board[i]))) - 1) });
      else play("tick");
      const top = best(sp.board);
      api.announce(
        `Swiped ${DIR_WORD[d]}.${s.gained ? ` Merged to ${Math.max(...s.mergedAt.map((i) => s.board[i]))}.` : ""} Best tile ${top}.`,
      );
      if (mode === "tutorial" && e.moves.length === 1)
        api.feedback("Matching tiles merge. Keep big tiles in a corner.", "info", "hand-pointing");
      else api.feedback(`Best tile ${top}, total ${total(sp.board)}`, "info", "arrows-merge");
      api.onMove({ moves: e.moves.slice() }, { correctStreak: s.mergedAt.length });
      if (!canMove(n, sp.board)) finish("stuck");
    },
    [api, disabled, finish, mode, n, now, over, puzzle.limitMs],
  );

  useEffect(() => {
    api.setControls([
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
      { id: "bank", label: "Bank it", icon: "check", onPress: () => finish("done"), disabled: !moveN || !!over, tone: "world" },
    ]);
  }, [api, finish, moveN, over]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Swipe to slide every tile. Equal tiles merge." : t.swipeToStart,
      "info",
      mode === "tutorial" ? "hand-pointing" : "arrows-merge",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const d = KEY_DIR[e.key];
    if (!d) return;
    e.preventDefault();
    move(d);
  };
  const onDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : dy > 0 ? "D" : "U");
  };

  const left = Math.max(0, puzzle.limitMs - elapsed);
  const frac = puzzle.limitMs > 0 ? left / puzzle.limitMs : 0;
  const hurry = left < 20_000 && moveN > 0;
  const hintDir = typeof hint?.target === "string" ? (hint.target as Dir) : null;
  const size = n * pitch - GAP + PAD * 2;
  const top = board.length ? best(board) : 0;

  return (
    <div className="flex flex-col gap-3" style={{ width }}>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 flex-col rounded-[14px] px-3 py-2" style={{ background: "var(--surface)" }}>
          <span className="text-muted text-[13px] font-medium">{t.bestTile}</span>
          <span className="num text-[24px] leading-tight font-semibold text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
            {top}
          </span>
        </div>
        <div className="flex flex-1 flex-col rounded-[14px] px-3 py-2" style={{ background: "var(--surface)" }}>
          <span className="text-muted text-[13px] font-medium">{t.total}</span>
          <span className="num text-[24px] leading-tight font-semibold">{board.length ? total(board) : 0}</span>
        </div>
      </div>
      {/* The run's time limit: a bar, never a second clock (the header holds the game's one clock). */}
      <div className="flex items-center gap-3">
        <span
          className="text-muted min-w-[56px] text-[13px] font-medium whitespace-nowrap"
          style={hurry ? { color: "var(--danger)" } : undefined}
        >
          {hurry ? t.hurry : t.time}
        </span>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full"
          style={{ background: "var(--surface)" }}
          role="progressbar"
          aria-label={t.timeBar}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(100 * frac)}
          aria-valuetext={t.timeSay(left)}
        >
          <div
            className="h-full w-full origin-left rounded-full"
            style={{
              background: hurry ? "var(--danger)" : "var(--world)",
              transform: `scaleX(${frac})`,
              transition: running ? "transform 200ms linear" : undefined,
            }}
          />
        </div>
      </div>

      <div
        role="grid"
        tabIndex={0}
        aria-label={`Merge board, ${n} by ${n}. Arrow keys slide the tiles.`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (swipe.current = null)}
        className={`relative touch-none rounded-[20px] outline-none select-none ${over ? "board-pulse" : ""}`}
        style={{ width: size, height: size, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)" }}
      >
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              return (
                <div
                  key={i}
                  role="gridcell"
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${board[i] ? board[i] : "empty"}`}
                  className="absolute rounded-[12px]"
                  style={{
                    left: PAD + c * pitch,
                    top: PAD + r * pitch,
                    width: cell,
                    height: cell,
                    background: "var(--surface)",
                    boxShadow: "inset 0 0 0 1px var(--line)",
                  }}
                />
              );
            })}
          </div>
        ))}
        {tiles.map((t) => {
          const r = Math.floor(t.at / n),
            c = t.at % n;
          const { bg, fg } = look(t.v);
          const digits = String(t.v).length;
          return (
            <div
              key={t.id}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0"
              style={{
                width: cell,
                height: cell,
                zIndex: t.fx === "gone" ? 1 : 2,
                transform: `translate(${PAD + c * pitch}px, ${PAD + r * pitch}px)`,
                transition: "transform 110ms var(--ease-out)",
              }}
            >
              <div
                key={`${t.v}-${moveN}`}
                className={`num flex h-full w-full items-center justify-center rounded-[12px] font-semibold ${t.fx === "merged" ? (moveN % 2 ? "cell-pop-a" : "cell-pop-b") : ""}`}
                style={{
                  background: bg,
                  color: fg,
                  fontSize: Math.round(cell * (digits <= 2 ? 0.42 : digits === 3 ? 0.34 : 0.27)),
                  boxShadow: "0 4px 0 var(--depth)",
                  ...(t.fx === "new" ? { animation: "fade-in 160ms var(--ease-out) 90ms both" } : {}),
                }}
              >
                {t.v}
              </div>
            </div>
          );
        })}
        {hintDir && !over && (
          <div aria-hidden className="hint-ring pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-float)" }}
            >
              <Icon name={{ U: "arrow-up", D: "arrow-down", L: "arrow-left", R: "arrow-right" }[hintDir]} size={28} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
