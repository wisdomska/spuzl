"use client";

import { useMemo } from "react";
import type { BoardProps } from "@/games/types";
import { QuizBoard, type QuizJudge, type QuizRound, type VerdictWords } from "@/games/_shared/QuizBoard";
import { sendGuess } from "@/games/_shared/guess";
import { twoTruths as t, TRUTHS_THEME_LABEL } from "@/lib/copy/twotruths";
// Rules and types only: content.ts and logic.ts hold the lies and must stay out of the client bundle.
import { REVEAL_MS, revealMsFor, type TruthsCheck, type TruthsGuess, type TruthsPuzzle, type TruthsState } from "./rules";

const WORDS: VerdictWords = {
  right: (_lie, fix = "") => t.right(fix),
  wrong: (lie, fix = "") => t.wrong(lie, fix),
  time: (lie, fix = "") => t.time(lie, fix),
  late: (lie, fix = "") => t.late(lie, fix),
};

/**
 * Two Truths and a Lie (R2-P5) on the shared timed quiz board: each round shows its theme and three statements,
 * the player taps the lie. The board never holds which one it is: each round is opened on the server when it
 * appears and each pick is judged there, which then sends the lie and what is true instead. Picks only: there is
 * no free text anywhere in this game, so it is the same for every age.
 */
export default function TwoTruthsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<TruthsPuzzle, TruthsState>) {
  const judge = useMemo<QuizJudge>(() => {
    const ask = (g: TruthsGuess) => sendGuess<TruthsCheck>(puzzle.ref, g);
    return {
      async open(q) {
        const r = await ask({ q, open: true });
        if (!r.ok) throw new Error("open refused");
        return { leftMs: r.leftMs ?? puzzle.limitMs, verdict: r.verdict && { ...r.verdict, note: r.verdict.fix } };
      },
      async answer(q, pick, ms) {
        let r = await ask({ q, pick, ms });
        // Not opened yet on the server (its open was lost): open it, then answer.
        if (!r.ok && "refused" in r) {
          await ask({ q, open: true });
          r = await ask({ q, pick, ms });
        }
        if (!r.ok || !r.verdict) throw new Error("answer not judged");
        return { ...r.verdict, note: r.verdict.fix };
      },
    };
  }, [puzzle]);
  const rounds = useMemo<QuizRound[]>(
    () =>
      puzzle.rounds.map((r) => ({
        tag: TRUTHS_THEME_LABEL[r.theme] ?? r.theme,
        say: `${TRUTHS_THEME_LABEL[r.theme] ?? r.theme}. ${t.ask}`,
        prompt: <p className="m-0 text-[19px] leading-[1.3] font-semibold text-balance">{t.ask}</p>,
        choices: r.statements,
      })),
    [puzzle],
  );
  return (
    <QuizBoard
      rounds={rounds}
      judge={judge}
      limitMs={puzzle.limitMs}
      noun={t.noun}
      initial={initialState?.answers}
      hint={hint}
      disabled={disabled}
      mode={mode}
      api={api}
      advanceMs={REVEAL_MS}
      revealMs={revealMsFor}
      hintLabel={t.hint}
      words={WORDS}
    />
  );
}
