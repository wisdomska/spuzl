"use client";

import { useMemo } from "react";
import type { BoardProps } from "@/games/types";
import { QuizBoard, type QuizJudge, type QuizRound } from "@/games/_shared/QuizBoard";
import { sendGuess } from "@/games/_shared/guess";
import { useGameSettings } from "@/lib/game-settings/client";
// Types only: logic.ts holds the question bank and must stay out of the client bundle (tests/unit/client-graph).
import type { QuickfireCheck, QuickfireGuess, QuickfirePuzzle, QuickfireState } from "./logic";

const CAT_LABEL = { africa: "Africa", sport: "Sport", music: "Music", science: "Science", world: "World" } as const;

/**
 * Quickfire: five questions, 15 seconds each, on the shared timed quiz board. The board never holds the
 * answers: each question is opened on the server when it appears, each answer is judged there (with the
 * server's clock) and only then is the right option shown. Answers stay hidden until Start; the next question
 * follows after the admin-tunable delay.
 */
export default function QuickfireBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<QuickfirePuzzle, QuickfireState>) {
  const advanceMs = useGameSettings()["quickfire.autoAdvanceMs"];
  const judge = useMemo<QuizJudge>(() => {
    const ask = (g: QuickfireGuess) => sendGuess<QuickfireCheck>(puzzle.ref, g);
    return {
      async open(q) {
        const r = await ask({ q, open: true });
        if (!r.ok) throw new Error("open refused");
        return { leftMs: r.leftMs ?? puzzle.limitMs, verdict: r.verdict };
      },
      async answer(q, pick, ms) {
        let r = await ask({ q, pick, ms });
        // Not opened yet on the server (its open was lost): open it, then answer.
        if (!r.ok && "refused" in r) {
          await ask({ q, open: true });
          r = await ask({ q, pick, ms });
        }
        if (!r.ok || !r.verdict) throw new Error("answer not judged");
        return r.verdict;
      },
    };
  }, [puzzle]);
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
      judge={judge}
      limitMs={puzzle.limitMs}
      noun="Question"
      initial={initialState?.answers}
      hint={hint}
      disabled={disabled}
      mode={mode}
      api={api}
      advanceMs={advanceMs}
    />
  );
}
