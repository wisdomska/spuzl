"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BoardApi, Hint, PlayMode } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { READ_FLOOR_MS, timedScore, type TimedAnswer } from "./cluecave";

const INK = "#0E0F1A";
const LETTERS = ["A", "B", "C", "D"];
const REVEAL_MS = 1100;

export interface QuizRound {
  prompt: ReactNode;
  /** plain text of the prompt for screen readers */
  say: string;
  /** small label above the prompt, e.g. a category */
  tag?: string;
  choices: string[];
}

interface Props {
  rounds: QuizRound[];
  correct: number[];
  limitMs: number;
  noun: string;
  initial?: TimedAnswer[];
  hint?: Hint | null;
  disabled?: boolean;
  mode: PlayMode;
  api: BoardApi<{ answers: TimedAnswer[] }>;
}

type Phase = "ready" | "asking" | "reveal" | "done";

/**
 * Timed multiple choice (Quickfire, Flagged). A world coloured bar drains over the time limit with a
 * seconds count beside it; answers carry letter badges so right and wrong never rely on colour. The
 * clock pauses with the shell. Taps under the reading floor are ignored, since the server rejects them.
 */
export function QuizBoard({ rounds, correct, limitMs, noun, initial, hint, disabled, mode, api }: Props) {
  const total = rounds.length;
  const [answers, setAnswers] = useState<TimedAnswer[]>(() => initial ?? []);
  const [phase, setPhase] = useState<Phase>(() => ((initial?.length ?? 0) >= total ? "done" : "ready"));
  const [left, setLeft] = useState(limitMs);
  const [shakeN, setShakeN] = useState(0);
  const answersRef = useRef(answers);
  const clock = useRef({ used: 0, since: 0 });
  const timer = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const streak = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const i = phase === "reveal" || phase === "done" ? Math.max(0, answers.length - 1) : answers.length;
  const round = rounds[Math.min(i, total - 1)];
  const last = answers[answers.length - 1];
  const struck = useMemo(
    () =>
      hint && typeof hint.target === "object" && hint.target && (hint.target as { question: number }).question === i && phase === "asking"
        ? (hint.target as { remove: number[] }).remove
        : [],
    [hint, i, phase],
  );

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = ticker.current = null;
  };
  useEffect(() => stop, []);

  const commit = useCallback(
    (pick: number | null) => {
      if (phaseRef.current !== "asking") return;
      const used = clock.current.used + performance.now() - clock.current.since;
      const ms = pick === null ? limitMs : Math.min(limitMs, Math.round(used));
      if (pick !== null && ms < READ_FLOOR_MS) return;
      stop();
      anim.current?.pause();
      const next = [...answersRef.current, { pick, ms }];
      answersRef.current = next;
      setAnswers(next);
      setPhase("reveal");
      const q = next.length - 1;
      const right = pick !== null && pick === correct[q];
      const answerText = rounds[q].choices[correct[q]];
      if (right) {
        streak.current++;
        play("pop", { step: streak.current });
        api.onMove({ answers: next }, { correctStreak: streak.current });
        api.feedback(`Right. ${answerText}.`, "success", "check-circle");
        api.announce(`Right. ${answerText}.`);
      } else {
        streak.current = 0;
        setShakeN((k) => k + 1);
        api.onMove({ answers: next }, { mistake: true });
        if (pick === null) {
          play("fizzle");
          api.feedback(`Time. It was ${answerText}.`, "danger", "timer");
          api.announce(`Time is up. It was ${answerText}.`);
        } else api.ruleBreak(`Not quite. It was ${answerText}.`);
      }
      timer.current = window.setTimeout(() => advance(next), REVEAL_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, correct, limitMs, rounds],
  );

  const runClock = useCallback(
    (remaining: number) => {
      clock.current.since = performance.now();
      stop();
      timer.current = window.setTimeout(() => commit(null), remaining);
      ticker.current = window.setInterval(
        () => setLeft(Math.max(0, limitMs - (clock.current.used + performance.now() - clock.current.since))),
        250,
      );
      anim.current?.play();
    },
    [commit, limitMs],
  );

  const ask = useCallback(() => {
    clock.current = { used: 0, since: performance.now() };
    setLeft(limitMs);
    setPhase("asking");
    anim.current?.cancel();
    anim.current =
      bar.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
        duration: limitMs,
        easing: "linear",
        fill: "forwards",
      }) ?? null;
    runClock(limitMs);
    const q = answersRef.current.length;
    api.announce(`${noun} ${q + 1} of ${total}. ${rounds[q].say}. ${rounds[q].choices.map((c, k) => `${LETTERS[k]}, ${c}`).join(". ")}`);
  }, [api, limitMs, noun, rounds, runClock, total]);

  function advance(next: TimedAnswer[]) {
    if (next.length >= total) {
      setPhase("done");
      const { score, right } = timedScore(next, correct, limitMs);
      play("jingle");
      api.feedback(`${right} of ${total} right. Score ${score}.`, "success", "check-circle");
      api.onSolved({ answers: next });
      return;
    }
    ask();
  }

  // Pause with the shell: freeze the clock and the bar, resume where it stopped.
  useEffect(() => {
    if (phase !== "asking") return;
    if (disabled) {
      clock.current.used += performance.now() - clock.current.since;
      stop();
      anim.current?.pause();
      return;
    }
    if (clock.current.used > 0) runClock(limitMs - clock.current.used);
  }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "asking" || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const k = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
      if (k >= 0 && k < round.choices.length && !struck.includes(k) && !(e.target instanceof HTMLInputElement)) commit(k);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, disabled, phase, round.choices.length, struck]);

  useEffect(() => {
    api.setControls([
      {
        id: "go",
        label:
          phase === "ready"
            ? answers.length
              ? "Resume"
              : "Start"
            : phase === "reveal"
              ? "Next"
              : phase === "done"
                ? "Done"
                : `${noun} ${i + 1} of ${total}`,
        icon: phase === "ready" ? "play" : phase === "reveal" ? "arrow-right" : phase === "done" ? "flag-checkered" : "timer",
        onPress: phase === "ready" ? ask : phase === "reveal" ? () => advance(answersRef.current) : () => {},
        tone: phase === "ready" || phase === "reveal" ? "world" : "default",
        disabled: disabled || phase === "asking" || phase === "done",
      },
      { id: "hint", label: "50:50", icon: "lightbulb", onPress: () => {}, tone: "gold", disabled: phase !== "asking" },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ask, disabled, i, noun, phase, total, answers.length]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial"
        ? "Press Start. Tap an answer before the bar runs out."
        : `${total} ${noun.toLowerCase()}s, ${Math.round(limitMs / 1000)} seconds each.`,
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showQ = phase !== "ready" || answers.length > 0;
  const secs = Math.ceil(left / 1000);

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3.5" style={{ background: "var(--board-bg)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-[5px]" role="img" aria-label={`${answers.length} of ${total} answered`}>
          {Array.from({ length: total }, (_, k) => {
            const a = answers[k];
            const ok = a && a.pick !== null && a.pick === correct[k];
            return (
              <span
                key={k}
                className="flex h-4 w-4 items-center justify-center rounded-[5px]"
                style={{
                  background: !a
                    ? k === i && phase === "asking"
                      ? "var(--text)"
                      : "color-mix(in srgb, var(--text-muted) 30%, var(--board-bg))"
                    : ok
                      ? "var(--world)"
                      : "var(--danger)",
                  color: INK,
                }}
              >
                {a && <Icon name={ok ? "check" : "x"} size={11} />}
              </span>
            );
          })}
        </div>
        <span className="flex-1" />
        <span className="num text-muted font-mono text-[13px] font-semibold" role="timer" aria-label={`${secs} seconds left`}>
          {phase === "asking" ? `${secs} s` : `${Math.round(limitMs / 1000)} s`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface)" }}>
        <div
          ref={bar}
          className="h-full w-full origin-left rounded-full"
          style={{
            background: phase === "asking" && left <= 5000 ? "var(--gold)" : "var(--world)",
            transform: phase === "ready" && !answers.length ? "scaleX(1)" : undefined,
          }}
        />
      </div>

      <div
        className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-center"
        style={{ background: "var(--surface)" }}
      >
        {showQ ? (
          <>
            {round.tag && <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">{round.tag}</span>}
            {round.prompt}
          </>
        ) : (
          <>
            <Icon name="timer" size={36} className="text-[var(--world)]" />
            <span className="text-[16px] font-semibold">{`${total} ${noun.toLowerCase()}s. ${Math.round(limitMs / 1000)} seconds each.`}</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2" role="group" aria-label="Answers">
        {round.choices.map((c, k) => {
          const revealed = phase === "reveal" || phase === "done";
          const picked = revealed && last?.pick === k;
          const isRight = revealed && k === correct[i];
          const wrongPick = picked && !isRight;
          const gone = struck.includes(k);
          return (
            <button
              key={`${i}:${k}`}
              type="button"
              disabled={disabled || phase !== "asking" || gone}
              onClick={() => commit(k)}
              aria-label={`${LETTERS[k]}, ${c}${isRight ? ", right answer" : ""}${wrongPick ? ", your answer, wrong" : ""}`}
              className={`press relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-[14px] px-3 text-left disabled:cursor-default ${wrongPick ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : isRight && picked ? "cell-pop-a" : ""}`}
              style={{
                background: isRight ? "var(--world)" : "var(--surface-raised)",
                color: isRight ? INK : "var(--text)",
                boxShadow: wrongPick ? "inset 0 0 0 3px var(--danger)" : isRight ? "0 4px 0 var(--world-depth)" : "0 4px 0 var(--depth)",
                opacity: gone ? 0.35 : revealed && !isRight && !picked ? 0.6 : 1,
              }}
            >
              {wrongPick && <span aria-hidden className="hatch absolute inset-0" />}
              <span
                className="relative flex h-7 w-7 flex-none items-center justify-center rounded-[8px] font-mono text-[13px] font-semibold"
                style={{ background: isRight ? "rgb(14 15 26 / .15)" : "var(--surface)" }}
              >
                {isRight ? <Icon name="check" size={14} /> : wrongPick ? <Icon name="x" size={14} /> : LETTERS[k]}
              </span>
              <span className={`relative text-[16px] font-semibold ${gone ? "line-through" : ""}`}>{c}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
