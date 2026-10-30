"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { gapOf, lineToGap, slide, solved, type Art, type ShufflePuzzle, type ShuffleState } from "./logic";

const GAP = 3;
const PAD = 6;

function ArtShapes({ art }: { art: Art }) {
  return (
    <>
      <rect x={0} y={0} width={100} height={100} fill={art.bg} />
      {art.shapes.map((s, k) =>
        s.t === "rect" ? (
          <rect key={k} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} transform={s.rot ? `rotate(${s.rot} ${s.x + s.w / 2} ${s.y + s.h / 2})` : undefined} />
        ) : s.t === "circle" ? (
          <circle key={k} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />
        ) : (
          <polygon key={k} points={s.pts.join(" ")} fill={s.fill} />
        ),
      )}
    </>
  );
}

/**
 * Shuffle board. Tap a tile in line with the gap to slide it (and any tiles between) into the gap,
 * or swipe toward the gap. Tiles move with a transform transition; the finished picture fills the gap
 * and flips in a wave from the last slide. Numbers can be shown for an easier read.
 */
export default function ShuffleBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<ShufflePuzzle, ShuffleState>) {
  const n = puzzle.size;
  const gap = gapOf(n);
  const artId = useId().replace(/:/g, "");
  const [moves, setMoves] = useState<number[]>(() => initialState?.moves.slice() ?? []);
  const [tiles, setTiles] = useState<number[]>(() => {
    let t = puzzle.tiles.slice();
    for (const id of initialState?.moves ?? []) t = slide(n, t, id) ?? t;
    return t;
  });
  const [numbers, setNumbers] = useState(false);
  const [bump, setBump] = useState<{ i: number; n: number } | null>(null);
  const [last, setLast] = useState(-1);
  const [done, setDone] = useState(false);
  const ref = useRef({ moves, tiles });
  const swipe = useRef<{ x: number; y: number; i: number } | null>(null);
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const on = () => setWidth(Math.min(358, window.innerWidth - 36));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const cell = Math.floor((width - PAD * 2 - GAP * (n - 1)) / n);
  const pitch = cell + GAP;

  const report = useCallback(
    (nextTiles: number[], nextMoves: number[], slid: number[]) => {
      ref.current = { moves: nextMoves, tiles: nextTiles };
      setTiles(nextTiles);
      setMoves(nextMoves);
      setLast(slid[slid.length - 1]);
      const win = solved(nextTiles);
      const homes = nextTiles.filter((t, i) => t === i && t !== gap).length;
      if (win) {
        setDone(true);
        play("jingle");
        api.feedback(`Picture whole in ${nextMoves.length} moves. Par ${puzzle.par}.`, "success", "check-circle");
        api.announce(`Picture complete in ${nextMoves.length} moves.`);
      } else {
        play("pop", { step: Math.min(7, homes) });
        api.feedback(mode === "tutorial" && nextMoves.length === 1 ? "Tiles slide into the gap. Rebuild the picture." : `Moves ${nextMoves.length}, par ${puzzle.par}`, "info", "arrows-out-cardinal");
        const at = nextTiles.indexOf(slid[slid.length - 1]);
        api.announce(`Tile ${slid.map((x) => x + 1).join(", ")} moved. Now at row ${Math.floor(at / n) + 1}, column ${(at % n) + 1}. ${homes} of ${gap} home.`);
      }
      api.onMove({ moves: nextMoves }, { correctStreak: homes });
      if (win) api.onSolved({ moves: nextMoves });
    },
    [api, gap, mode, n, puzzle.par],
  );

  /** Slide the tile at board position i (and the tiles between it and the gap). */
  const tapAt = useCallback(
    (i: number) => {
      if (disabled || done) return;
      const cur = ref.current;
      const line = lineToGap(n, cur.tiles, i);
      if (!line.length) {
        if (cur.tiles[i] !== gap) {
          setBump((b) => ({ i, n: (b?.n ?? 0) + 1 }));
          play("tick");
          api.announce("That tile is not in line with the gap.");
        }
        return;
      }
      let t = cur.tiles;
      for (const id of line) t = slide(n, t, id)!;
      report(t, [...cur.moves, ...line], line);
    },
    [api, disabled, done, gap, n, report],
  );

  const undo = useCallback(() => {
    const cur = ref.current;
    if (!cur.moves.length || done || disabled) return;
    const id = cur.moves[cur.moves.length - 1];
    const t = slide(n, cur.tiles, id)!;
    const m = cur.moves.slice(0, -1);
    ref.current = { moves: m, tiles: t };
    setTiles(t);
    setMoves(m);
    setLast(id);
    play("tick");
    api.announce(`Tile ${id + 1} moved back.`);
    api.onMove({ moves: m });
  }, [api, disabled, done, n]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !moves.length || done },
      { id: "numbers", label: "Numbers", icon: "hash", onPress: () => setNumbers((v) => !v), active: numbers },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, moves.length, done, numbers]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? "Tap a tile next to the gap to slide it." : `Moves 0, par ${puzzle.par}`, "info", mode === "tutorial" ? "hand-pointing" : "arrows-out-cardinal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, tapAt);

  const onDown = (e: PointerEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    swipe.current = { x: e.clientX, y: e.clientY, i: t ? Number(t.dataset.i) : -1 };
  };
  const onUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 18) {
      if (s.i >= 0) {
        keys.setFocus(s.i);
        tapAt(s.i);
      }
      return;
    }
    // swipe: the tile on the far side of the gap from the swipe direction moves into it
    const g = ref.current.tiles.indexOf(gap);
    const gr = Math.floor(g / n), gc = g % n;
    const [r, c] = Math.abs(dx) > Math.abs(dy) ? [gr, gc - Math.sign(dx)] : [gr - Math.sign(dy), gc];
    if (r >= 0 && c >= 0 && r < n && c < n) tapAt(r * n + c);
  };

  const hintId = typeof hint?.target === "number" ? hint.target : -1;
  const lastPos = tiles.indexOf(last);
  const size = n * pitch - GAP + PAD * 2;

  return (
    <div className={done ? "board-pulse" : ""}>
      <svg width={0} height={0} className="absolute" aria-hidden>
        <defs>
          <g id={`art-${artId}`}>
            <ArtShapes art={puzzle.art} />
          </g>
        </defs>
      </svg>
      <div
        role="grid"
        aria-label={`Shuffle board, ${n} by ${n}. Par ${puzzle.par} moves.`}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={keys.onKeyDown}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (swipe.current = null)}
        className="relative touch-none rounded-[20px] select-none"
        style={{ width: size, height: size, background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)", perspective: 600 }}
      >
        {/* focus targets and screen reader cells, one per board position */}
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const t = tiles[i];
              const home = t === i;
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={t === gap ? `Row ${r + 1}, column ${c + 1}, gap` : `Row ${r + 1}, column ${c + 1}, tile ${t + 1}${home ? ", home" : ""}`}
                  aria-selected={home && t !== gap}
                  className="absolute z-20 cursor-pointer rounded-[10px] outline-none"
                  style={{ left: PAD + c * pitch, top: PAD + r * pitch, width: cell, height: cell }}
                />
              );
            })}
          </div>
        ))}

        {/* tiles */}
        {Array.from({ length: n * n }, (_, id) => {
          if (id === gap && !done) return null;
          const at = tiles.indexOf(id);
          const r = Math.floor(at / n), c = at % n;
          const hr = Math.floor(id / n), hc = id % n;
          const home = at === id;
          const dist = Math.abs(r - Math.floor(lastPos / n)) + Math.abs(c - (lastPos % n));
          const bumped = bump && tiles[bump.i] === id;
          return (
            <div
              key={id}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0"
              style={{
                width: cell,
                height: cell,
                transform: `translate(${PAD + c * pitch}px, ${PAD + r * pitch}px)`,
                transition: "transform 140ms var(--ease-out)",
              }}
            >
              <div
                key={bumped ? bump!.n : 0}
                className={`relative h-full w-full overflow-hidden rounded-[10px] ${bumped ? (bump!.n % 2 ? "cell-shake-a" : "cell-shake-b") : ""} ${id === hintId ? "hint-ring" : ""}`}
                style={{
                  boxShadow: id === hintId ? "0 0 0 3px var(--accent)" : "0 3px 0 var(--depth)",
                  ...(done ? { animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both${id === gap ? `, fade-in 220ms var(--ease-out) both` : ""}` } : {}),
                }}
              >
                <svg viewBox={`${(hc * 100) / n} ${(hr * 100) / n} ${100 / n} ${100 / n}`} width={cell} height={cell} preserveAspectRatio="none" className="block">
                  <use href={`#art-${artId}`} />
                </svg>
                {(numbers || mode === "tutorial") && !done && (
                  <span
                    className="num absolute top-1 left-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-bold"
                    style={{ background: home ? "var(--world)" : "#0E0F1A", color: home ? "#0E0F1A" : "#F4F5FB" }}
                  >
                    {id + 1}
                  </span>
                )}
                {home && !done && <span className="absolute right-1.5 bottom-1.5 h-2 w-2 rounded-full" style={{ background: "var(--world)", boxShadow: "0 0 0 2px #0E0F1A" }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
