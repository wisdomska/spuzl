"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useFitCell } from "@/games/_shared/useFitCell";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BIT, DIR_NAME } from "@/games/_shared/grid";
import { LineStyles } from "@/games/_shared/LineStyles";
import { analyze, masksOf, type FlowlinePuzzle, type FlowlineState } from "./logic";

const GAP = 3;
const PAD = 6;
const INK = "#0E0F1A";
const DRY = "color-mix(in srgb, var(--text-muted) 40%, var(--surface))";

/**
 * Flowline board (Game Boards: Flowline). Tap a tile to turn it 90 degrees clockwise with a 180 ms
 * spring. Water runs from the source through joined pipes; lit pipes take the world colour and pulse
 * outwards from the source. Keyboard: arrows move, Space or Enter turns the focused tile.
 */
export default function FlowlineBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<FlowlinePuzzle, FlowlineState>) {
  const { rows, cols } = puzzle;
  const N = rows * cols;
  const locked = useMemo(() => new Set(puzzle.locked), [puzzle.locked]);
  const plants = useMemo(() => new Set(puzzle.plants), [puzzle.plants]);
  const [turns, setTurns] = useState<FlowlineState>(() => initialState?.slice() ?? new Array(N).fill(0));
  /** cumulative quarter turns per tile so the spring always turns clockwise */
  const [spin, setSpin] = useState<number[]>(() => turns.slice());
  const [hist, setHist] = useState<number[]>([]);
  const [pulse, setPulse] = useState(0);
  const [tapN, setTapN] = useState(0);
  const [last, setLast] = useState(puzzle.source);
  const turnsRef = useRef(turns);
  const streak = useRef(0);
  const { cs, bleed } = useFitCell(cols, GAP, PAD);
  const masks = masksOf(puzzle, turns);
  const a = analyze(puzzle, masks);
  const [done, setDone] = useState(a.solved);
  const th = Math.max(10, Math.round(cs * 0.27));

  const report = useCallback(
    (next: FlowlineState, i: number, prevLit: number) => {
      const m = masksOf(puzzle, next);
      const after = analyze(puzzle, m);
      const r = Math.floor(i / cols) + 1,
        c = (i % cols) + 1;
      const opens = [0, 1, 2, 3]
        .filter((d) => m[i] & BIT[d])
        .map((d) => DIR_NAME[d])
        .join(" and ");
      if (after.lit.size > prevLit) {
        streak.current++;
        setPulse((p) => p + 1);
      }
      if (after.solved) {
        setDone(true);
        play("jingle");
        api.feedback("Every plant has water.", "success", "check-circle");
        api.announce("Board cleared.");
        api.onMove(next, { correctStreak: streak.current });
        api.onSolved(next);
        return;
      }
      play("pop", { step: after.plantsLit });
      api.announce(
        `Row ${r}, column ${c}, opens ${opens}, ${after.lit.has(i) ? "wet" : "dry"}. ${after.plantsLit} of ${puzzle.plants.length} plants watered.`,
      );
      api.feedback(`${after.plantsLit} of ${puzzle.plants.length} plants watered`, "info", "drop");
      api.onMove(next, { correctStreak: streak.current });
    },
    [api, cols, puzzle],
  );

  const turn = useCallback(
    (i: number) => {
      if (disabled || done) return;
      if (locked.has(i)) {
        api.feedback("That pipe is fixed in place.", "info", "lock-simple");
        api.announce(`Row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1}, fixed pipe.`);
        return;
      }
      const prev = turnsRef.current;
      const prevLit = analyze(puzzle, masksOf(puzzle, prev)).lit.size;
      const next = prev.slice();
      next[i] = (next[i] + 1) % 4;
      turnsRef.current = next;
      setTurns(next);
      setSpin((s) => {
        const t = s.slice();
        t[i]++;
        return t;
      });
      setHist((h) => [...h, i]);
      setLast(i);
      setTapN((t) => t + 1);
      report(next, i, prevLit);
    },
    [api, cols, disabled, done, locked, puzzle, report],
  );

  const undo = useCallback(() => {
    if (done || !hist.length) return;
    const i = hist[hist.length - 1];
    const prev = turnsRef.current;
    const prevLit = analyze(puzzle, masksOf(puzzle, prev)).lit.size;
    const next = prev.slice();
    next[i] = (next[i] + 3) % 4;
    turnsRef.current = next;
    setTurns(next);
    setSpin((s) => {
      const t = s.slice();
      t[i]--;
      return t;
    });
    setHist((h) => h.slice(0, -1));
    setLast(i);
    report(next, i, prevLit);
  }, [done, hist, puzzle, report]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, hist.length, done]);

  useEffect(() => {
    if (done) return;
    api.feedback(
      mode === "tutorial"
        ? "Tap a pipe to turn it. Join every pipe to the source."
        : `${a.plantsLit} of ${puzzle.plants.length} plants watered`,
      "info",
      mode === "tutorial" ? "hand-pointing" : "drop",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(rows, cols, turn);
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const lr = Math.floor(last / cols),
    lc = last % cols;

  /** one pipe arm from the centre out past the edge, so neighbouring arms meet in the gap */
  const arm = (d: number, color: string, delay = 0) => {
    const m = cs / 2,
      h = th / 2;
    const ext = GAP / 2 + 0.5;
    const s =
      d === 0
        ? { left: m - h, top: -ext, width: th, height: m + h + ext }
        : d === 2
          ? { left: m - h, top: m - h, width: th, height: m + h + ext }
          : d === 1
            ? { left: m - h, top: m - h, width: m + h + ext, height: th }
            : { left: -ext, top: m - h, width: m + h + ext, height: th };
    return (
      <div
        key={d}
        className="absolute"
        style={{ ...s, borderRadius: h, background: color, transition: `background-color 1ms linear ${delay}ms` }}
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
        role="grid"
        aria-label={`Flowline board, ${rows} rows by ${cols} columns`}
        aria-rowcount={rows}
        aria-colcount={cols}
        onKeyDown={keys.onKeyDown}
        className="grid rounded-[16px] select-none"
        style={{ gridTemplateColumns: `repeat(${cols}, ${cs}px)`, gap: GAP, padding: PAD, background: "var(--board-bg)", perspective: 600 }}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: cols }, (_, c) => {
              const i = r * cols + c;
              const wet = a.lit.has(i);
              const isSource = i === puzzle.source;
              const isPlant = plants.has(i);
              const isLocked = locked.has(i);
              const glow = i === hintTarget;
              const color = isSource || done ? `color-mix(in srgb, var(--world) 45%, ${INK})` : wet ? "var(--world)" : DRY;
              const dist = Math.abs(r - lr) + Math.abs(c - lc);
              const anim = i === last && !done ? (tapN % 2 ? "cell-pop-a" : "cell-pop-b") : "";
              const opens = [0, 1, 2, 3]
                .filter((d) => masks[i] & BIT[d])
                .map((d) => DIR_NAME[d])
                .join(" and ");
              const kind = isSource ? "source" : isPlant ? "plant" : "pipe";
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${kind}, opens ${opens}, ${wet ? "wet" : "dry"}${isLocked ? ", fixed" : ""}`}
                  aria-selected={wet}
                  onClick={() => {
                    keys.setFocus(i);
                    turn(i);
                  }}
                  className={`relative flex items-center justify-center rounded-[10px] outline-none focus-visible:z-10 focus-visible:shadow-[var(--focus-ring)] ${isLocked ? "" : "cursor-pointer"} ${anim} ${glow ? "hint-ring" : ""}`}
                  style={{
                    width: cs,
                    height: cs,
                    background: isSource ? "var(--world)" : "var(--surface)",
                    boxShadow: glow ? "inset 0 0 0 4px var(--accent)" : undefined,
                  }}
                >
                  {done && !isSource && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[10px]"
                      style={{
                        background: "var(--world)",
                        animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both, fade-in 1ms linear ${dist * 70 + 250}ms both`,
                      }}
                    />
                  )}
                  <div aria-hidden className="ll-turn absolute inset-0" style={{ transform: `rotate(${spin[i] * 90}deg)` }}>
                    <div
                      key={wet ? `w${pulse}` : "dry"}
                      className={`absolute inset-0 ${wet && !done ? "ll-flow" : ""}`}
                      style={{ animationDelay: `${(a.dist.get(i) ?? 0) * 40}ms` }}
                    >
                      {[0, 1, 2, 3].filter((d) => puzzle.tiles[i] & BIT[d]).map((d) => arm(d, color, done ? dist * 70 + 250 : 0))}
                    </div>
                  </div>
                  {isSource && <Icon name="drop" size={Math.round(cs * 0.42)} className="relative" style={{ color: INK }} />}
                  {isPlant && (
                    <span
                      className="relative flex items-center justify-center rounded-full"
                      style={{
                        width: cs * 0.56,
                        height: cs * 0.56,
                        background: done ? INK : "var(--surface)",
                        boxShadow: `inset 0 0 0 2px ${wet || done ? "var(--world)" : DRY}`,
                        color: wet || done ? "var(--world)" : "var(--text-muted)",
                      }}
                    >
                      <Icon name="plant" size={Math.round(cs * 0.36)} />
                    </span>
                  )}
                  {isLocked && (
                    <span className="absolute top-[3px] right-[3px] flex" style={{ color: isSource ? INK : "var(--text-muted)" }}>
                      <Icon name="lock-simple" size={12} />
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
