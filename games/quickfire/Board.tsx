"use client";

import { useMemo } from "react";
import type { BoardProps } from "@/games/types";
import { QuizBoard, type QuizRound } from "@/games/_shared/QuizBoard";
import { unseal } from "@/games/_shared/cluecave";
import { sealKey, type QuickfirePuzzle, type QuickfireState } from "./logic";

const CAT_LABEL = { africa: "Africa", sport: "Sport", music: "Music", science: "Science", world: "World" } as const;

/** Quickfire: five questions, 15 seconds each, on the shared timed quiz board. */
export default function QuickfireBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<QuickfirePuzzle, QuickfireState>) {
  const correct = useMemo(() => unseal<number[]>(puzzle.sealed, sealKey(puzzle.ref)), [puzzle]);
  const rounds = useMemo<QuizRound[]>(
    () =>
      puzzle.questions.map((q) => ({
        tag: CAT_LABEL[q.cat],
        say: q.q,
        prompt: <p className="m-0 text-[19px] leading-[1.3] font-semibold text-balance">{q.q}</p>,
        choices: q.choices,
      })),
    [puzzle],
  );
  return (
    <QuizBoard
      rounds={rounds}
      correct={correct}
      limitMs={puzzle.limitMs}
      noun="Question"
      initial={initialState?.answers}
      hint={hint}
      disabled={disabled}
      mode={mode}
      api={api}
    />
  );
}
