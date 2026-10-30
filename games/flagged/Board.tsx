"use client";

import { useMemo } from "react";
import type { BoardProps } from "@/games/types";
import { QuizBoard, type QuizRound } from "@/games/_shared/QuizBoard";
import { unseal } from "@/games/_shared/cluecave";
import { Flag } from "./Flag";
import { sealKey, type FlaggedPuzzle, type FlaggedState } from "./logic";

/** Flagged: ten 10 second rounds on the shared timed quiz board. Flags are drawn as SVG. */
export default function FlaggedBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<FlaggedPuzzle, FlaggedState>) {
  const correct = useMemo(() => unseal<number[]>(puzzle.sealed, sealKey(puzzle.ref)), [puzzle]);
  const rounds = useMemo<QuizRound[]>(
    () =>
      puzzle.rounds.map((r) => {
        if (r.kind === "flag")
          return { tag: "Flag", say: "Whose flag is this?", choices: r.choices, prompt: <Flag spec={r.flag!} width={r.flag!.w === r.flag!.h ? 96 : 150} label="Flag to name" /> };
        const say = r.kind === "capital" ? `What is the capital of ${r.country}?` : `Which currency does ${r.country} use?`;
        return { tag: r.kind === "capital" ? "Capital" : "Currency", say, choices: r.choices, prompt: <p className="m-0 text-[19px] leading-[1.3] font-semibold text-balance">{say}</p> };
      }),
    [puzzle],
  );
  return <QuizBoard rounds={rounds} correct={correct} limitMs={puzzle.limitMs} noun="Round" initial={initialState?.answers} hint={hint} disabled={disabled} mode={mode} api={api} />;
}
