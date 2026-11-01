"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BoardProps } from "@/games/types";
import { play } from "@/lib/audio";
import { dara as t } from "@/lib/copy/dara";
import { DaraGrid } from "./DaraGrid";
import { cellName, replay, type DaraPuzzle, type DaraState, type PuzzleMove } from "./logic";
import { NEIGHBOURS, makesThree, steps, threeThrough } from "./rules";

const ME = 1,
  THEM = 2;

/**
 * Dara puzzle board (Board Bay). Tap one of your light stones, then a cell next to it. A step that makes
 * exactly three asks you to tap one of their stones to take. On "three in 2" days their reply plays at once
 * and the board says where they went. Wrong steps shake and are not kept; Undo takes back your first step.
 */
export default function DaraBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<DaraPuzzle, DaraState>) {
  const [moves, setMoves] = useState<PuzzleMove[]>(() => initialState?.moves?.filter((m) => m.take === undefined) ?? []);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ from: number; to: number } | null>(null);
  const [done, setDone] = useState(false);
  const [line, setLine] = useState<number[]>([]);
  const r = useMemo(() => replay(puzzle, moves), [puzzle, moves]);
  // While a take is pending, show the stone already stepped.
  const board = useMemo(() => {
    if (!pending) return r.board;
    const b = r.board.slice();
    b[pending.to] = ME;
    b[pending.from] = 0;
    return b;
  }, [r.board, pending]);
  const locked = !!disabled || done;
  const mySteps = useMemo(() => steps(r.board, ME), [r.board]);
  const movable = pending || locked ? [] : [...new Set(mySteps.map((s) => s.from))];
  const targets = selected === null || pending ? [] : mySteps.filter((s) => s.from === selected).map((s) => s.to);
  const takeable = pending ? board.flatMap((v, i) => (v === THEM ? [i] : [])) : [];
  const lastReply = r.replies.at(-1);

  const goal = t.goal[puzzle.goal];
  useEffect(() => {
    api.feedback(goal, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slip = useCallback(
    (text: string) => {
      api.ruleBreak(text);
      api.onMove({ moves }, { mistake: true });
    },
    [api, moves],
  );

  const tap = useCallback(
    (i: number) => {
      if (locked) return;
      if (pending) {
        if (board[i] !== THEM) {
          setPending(null);
          setSelected(null);
          setLine([]);
          api.feedback(t.cancelTake, "info", "hand-pointing");
          return;
        }
        const m = { ...pending, take: i };
        const res = replay(puzzle, [...moves, m]);
        if (!res.won) {
          slip(t.wrongTake);
          return;
        }
        play("capture");
        setPending(null);
        setSelected(null);
        setDone(true);
        setMoves([...moves, m]);
        api.feedback(t.took, "success", "check-circle");
        api.announce(t.took);
        api.onMove({ moves: [...moves, m] }, { correctStreak: moves.length + 1 });
        api.onSolved({ moves: [...moves, m] });
        return;
      }
      const v = r.board[i];
      if (v === ME) {
        if (!mySteps.some((s) => s.from === i)) {
          api.feedback(t.noStep, "info", "prohibit");
          return;
        }
        play("tick");
        setSelected(i);
        api.announce(t.picked1(cellName(i)));
        return;
      }
      if (v === THEM) {
        api.feedback(t.notYours, "info", "hand-pointing");
        return;
      }
      if (selected === null || !NEIGHBOURS[selected].includes(i)) return;
      const from = selected;
      if (makesThree(r.board, from, i, ME)) {
        const b = r.board.slice();
        b[i] = ME;
        b[from] = 0;
        play("clack");
        setPending({ from, to: i });
        setLine(threeThrough(b, i, ME));
        const text = puzzle.goal === "block" ? t.threeBlock : t.three;
        api.feedback(text, "info", "hand-pointing");
        api.announce(text);
        return;
      }
      // A plain step only counts as the first move of "three in 2", and only when they cannot stop it.
      if (puzzle.goal !== "three2" || moves.length > 0) {
        setSelected(null);
        slip(t.noThree);
        return;
      }
      const m = { from, to: i };
      const res = replay(puzzle, [m]);
      if (res.wrongAt >= 0) {
        setSelected(null);
        slip(t.notForcing);
        return;
      }
      play("clack");
      setSelected(null);
      setMoves([m]);
      const reply = res.replies[0];
      const text = t.replied(cellName(reply.to));
      api.feedback(text, "info", "hand-pointing");
      api.announce(text);
      api.onMove({ moves: [m] }, { correctStreak: 1 });
    },
    [locked, pending, board, puzzle, moves, r.board, mySteps, selected, api, slip],
  );

  const undo = useCallback(() => {
    if (locked) return;
    if (pending || selected !== null) {
      setPending(null);
      setSelected(null);
      setLine([]);
      api.feedback(goal, "info", "hand-pointing");
      return;
    }
    if (!moves.length) return;
    setMoves([]);
    api.onMove({ moves: [] });
    api.feedback(goal, "info", "hand-pointing");
  }, [locked, pending, selected, moves.length, api, goal]);

  useEffect(() => {
    api.setControls([
      {
        id: "undo",
        label: t.undo,
        icon: "arrow-counter-clockwise",
        onPress: undo,
        disabled: locked || (!moves.length && !pending && selected === null),
      },
      { id: "hint", label: t.hint, icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, locked, moves.length, pending, selected]);

  const hintCell = typeof hint?.target === "number" && !done ? hint.target : -1;

  return (
    <div className="flex w-full flex-col items-center gap-3" data-board="dara">
      <DaraGrid
        board={board}
        selected={pending ? pending.to : selected}
        targets={targets}
        takeable={takeable}
        movable={movable}
        last={lastReply ? [lastReply.from, lastReply.to] : []}
        line={pending || done ? line : []}
        hintCell={hintCell}
        disabled={locked}
        onTap={tap}
      />
    </div>
  );
}
