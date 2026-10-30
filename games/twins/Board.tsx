"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { FACES, pairsOf, replay, type TwinsPuzzle, type TwinsState } from "./logic";

const INK = "#0E0F1A";
const GAP = 8;
/** How long a mismatched pair stays face up before it turns back */
const SHOW_MS = 900;

/**
 * Twins board. Cards turn with a short rotateY flip; a matched pair fills with the world colour and
 * keeps its glyph. A mismatch turns back after 900 ms, or straight away on the next tap.
 */
export default function TwinsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<TwinsPuzzle, TwinsState>) {
  const pairs = pairsOf(puzzle);
  const [state, setState] = useState<TwinsState>(() => initialState ?? { flips: [] });
  /** cards currently face up but not matched */
  const [up, setUp] = useState<number[]>([]);
  const [flipN, setFlipN] = useState<Record<number, number>>({});
  const [last, setLast] = useState(-1);
  const stateRef = useRef(state);
  const upRef = useRef<number[]>([]);
  const t0 = useRef<number | null>(null);
  const turnBack = useRef<number | null>(null);
  const streak = useRef(0);
  const cell = useCellSize(puzzle.cols, GAP, 12, 76);

  const r = replay(puzzle, state);
  const done = r.matched === pairs;

  useEffect(
    () => () => {
      if (turnBack.current) window.clearTimeout(turnBack.current);
    },
    [],
  );

  const hideUp = () => {
    if (turnBack.current) window.clearTimeout(turnBack.current);
    turnBack.current = null;
    const was = upRef.current;
    setFlipN((f) => Object.fromEntries([...Object.entries(f), ...was.map((c) => [c, (f[c] ?? 0) + 1])]));
    upRef.current = [];
    setUp([]);
  };

  const flip = useCallback(
    (i: number) => {
      if (disabled || done) return;
      const cur = replay(puzzle, stateRef.current);
      if (cur.done.has(i)) return;
      // A third tap while a mismatch is showing turns it back first.
      if (upRef.current.length === 2) hideUp();
      if (upRef.current.includes(i)) return;
      const now = performance.now();
      if (t0.current === null || stateRef.current.flips.length === 0) t0.current = now;
      const ms = Math.round(now - t0.current);
      const prev = stateRef.current.flips[stateRef.current.flips.length - 1];
      if (prev && ms - prev[1] < 100) return; // under the human floor: ignore, never submit
      const next: TwinsState = { flips: [...stateRef.current.flips, [i, stateRef.current.flips.length ? ms : 0]] };
      stateRef.current = next;
      setState(next);
      setLast(i);
      setFlipN((f) => ({ ...f, [i]: (f[i] ?? 0) + 1 }));
      const face = FACES[puzzle.faces[i]].replace(/-/g, " ").replace(" simple", "");
      const row = Math.floor(i / puzzle.cols) + 1,
        col = (i % puzzle.cols) + 1;
      const after = replay(puzzle, next);
      const open = [...upRef.current, i];
      if (open.length === 1) {
        upRef.current = open;
        setUp(open);
        play("tick");
        api.onMove(next);
        api.announce(`Row ${row}, column ${col}, ${face}`);
        return;
      }
      const [a] = open;
      if (puzzle.faces[a] === puzzle.faces[i]) {
        streak.current++;
        upRef.current = [];
        setUp([]);
        api.onMove(next, { correctStreak: streak.current });
        if (after.matched === pairs) {
          play("jingle");
          api.feedback(`All ${pairs} pairs in ${next.flips.length} flips.`, "success", "check-circle");
          api.announce(`Row ${row}, column ${col}, ${face}. Pair. Board cleared in ${next.flips.length} flips.`);
          api.onSolved(next);
        } else {
          play("pop", { step: streak.current });
          api.feedback(`Pair. ${after.matched} of ${pairs}, ${next.flips.length} flips.`, "info", "cards");
          api.announce(`Row ${row}, column ${col}, ${face}. Pair, ${after.matched} of ${pairs}.`);
        }
      } else {
        streak.current = 0;
        upRef.current = open;
        setUp(open);
        play("whoosh");
        api.onMove(next);
        api.feedback(`No match. ${after.matched} of ${pairs}, ${next.flips.length} flips.`, "info", "cards");
        api.announce(`Row ${row}, column ${col}, ${face}. No match.`);
        turnBack.current = window.setTimeout(hideUp, SHOW_MS);
      }
    },
    [api, disabled, done, pairs, puzzle],
  );

  useEffect(() => {
    api.setControls([{ id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" }]);
  }, [api]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Tap two cards. Same glyph, they stay." : `Find all ${pairs} pairs in the fewest flips.`,
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(puzzle.rows, puzzle.cols, flip);
  const hinted = Array.isArray(hint?.target) ? (hint!.target as number[]) : [];
  const lastR = Math.floor(last / puzzle.cols),
    lastC = last % puzzle.cols;

  return (
    <div className={`overflow-x-auto ${done ? "board-pulse" : ""}`} style={{ maxWidth: "100%" }}>
      <div
        role="grid"
        aria-label={`Twins board, ${puzzle.rows} by ${puzzle.cols}, ${pairs} pairs`}
        aria-rowcount={puzzle.rows}
        aria-colcount={puzzle.cols}
        onKeyDown={keys.onKeyDown}
        className="grid rounded-[20px] p-1.5"
        style={{ gridTemplateColumns: `repeat(${puzzle.cols}, ${cell}px)`, gap: GAP, background: "var(--board-bg)", perspective: 600 }}
      >
        {Array.from({ length: puzzle.rows }, (_, row) => (
          <div role="row" key={row} className="contents">
            {Array.from({ length: puzzle.cols }, (_, col) => {
              const i = row * puzzle.cols + col;
              const matched = r.done.has(i);
              const shown = matched || up.includes(i);
              const face = FACES[puzzle.faces[i]];
              const label = face.replace(/-/g, " ").replace(" simple", "");
              const dist = Math.abs(row - lastR) + Math.abs(col - lastC);
              const glow = hinted.includes(i) && !matched;
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`Row ${row + 1}, column ${col + 1}, ${matched ? `${label}, matched` : shown ? label : "face down"}`}
                  aria-selected={shown}
                  onClick={() => {
                    keys.setFocus(i);
                    flip(i);
                  }}
                  className={`relative flex cursor-pointer items-center justify-center rounded-[14px] text-[var(--world)] outline-none focus-visible:z-10 [[data-theme=light]_&]:text-[var(--world-ink)] ${glow ? "hint-ring" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    background: matched
                      ? "var(--world)"
                      : shown
                        ? "var(--surface-raised)"
                        : "color-mix(in srgb, var(--world) 22%, var(--surface))",
                    color: matched ? INK : undefined,
                    boxShadow: glow
                      ? "inset 0 0 0 4px var(--accent)"
                      : shown && !matched
                        ? "inset 0 0 0 2px var(--world), 0 4px 0 var(--depth)"
                        : "0 4px 0 var(--depth)",
                    animation: done
                      ? `cell-flip 500ms var(--ease-out) ${dist * 70}ms both`
                      : flipN[i]
                        ? `${flipN[i] % 2 ? "flip-in 180ms" : "cell-flip 240ms"} var(--ease-out)`
                        : undefined,
                  }}
                >
                  {shown ? (
                    <Icon name={face} size={Math.round(cell * 0.48)} />
                  ) : (
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--world) 55%, transparent)" }}
                    />
                  )}
                  {matched && !done && <Icon name="check" size={12} className="absolute top-1.5 right-1.5" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
