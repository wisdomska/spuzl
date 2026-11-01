"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BoardApi, Hint, PlayMode } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { quick } from "@/lib/copy/quick";
import { READ_FLOOR_MS, timedScore, type TimedAnswer } from "./cluecave";

const INK = "#0E0F1A";
const LETTERS = ["A", "B", "C", "D"];
/** default pause on the revealed answer before the next question (Quickfire passes its game setting) */
const REVEAL_MS = 1100;
const t = quick.quiz;

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
  /** how long the revealed answer stays before the next question appears on its own */
  advanceMs?: number;
}

type Phase = "ready" | "asking" | "reveal" | "done";

/**
 * Timed multiple choice (Quickfire, Flagged). The shell header holds the only clock; each question's
 * time limit is a world coloured bar that drains inside the card (no second mm:ss). Answers stay hidden
 * until Start. After an answer the right one is shown (letter badges and ticks, so never colour alone),
 * then the next question appears on its own after `advanceMs`: there is no Next button. The run ends
 * on a summary ("4 of 5 · 469 pts"). The bar pauses with the shell. Taps under the reading floor are
 * ignored, since the server rejects them.
 */
export function QuizBoard({ rounds, correct, limitMs, noun, initial, hint, disabled, mode, api, advanceMs = REVEAL_MS }: Props) {
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
  const disabledRef = useRef(disabled);
  useEffect(() => {
    phaseRef.current = phase;
    disabledRef.current = disabled;
  }, [phase, disabled]);

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
  const summary = useMemo(() => {
    const { score, right } = timedScore(answers, correct, limitMs);
    return { score, right };
  }, [answers, correct, limitMs]);

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = ticker.current = null;
  };
  useEffect(() => stop, []);
  // The time-up callback reads the latest commit (declared below, after the advance helpers).
  const commitRef = useRef<(pick: number | null) => void>(() => {});

  const runClock = useCallback(
    (remaining: number) => {
      clock.current.since = performance.now();
      stop();
      timer.current = window.setTimeout(() => commitRef.current(null), remaining);
      ticker.current = window.setInterval(
        () => setLeft(Math.max(0, limitMs - (clock.current.used + performance.now() - clock.current.since))),
        250,
      );
      anim.current?.play();
    },
    [limitMs],
  );

  const ask = useCallback(() => {
    // The header clock runs from Start, not from the first answer.
    api.start?.();
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
    api.announce(`${t.step(noun, q + 1, total)}. ${rounds[q].say}. ${rounds[q].choices.map((c, k) => `${LETTERS[k]}, ${c}`).join(". ")}`);
  }, [api, limitMs, noun, rounds, runClock, total]);

  // One advance model: the next question (or the summary) follows the reveal on its own.
  const advance = useCallback(() => {
    const next = answersRef.current;
    if (next.length >= total) {
      setPhase("done");
      const { score, right } = timedScore(next, correct, limitMs);
      play("jingle");
      api.feedback(t.summary(right, total, score), "info", "flag-checkered");
      api.announce(t.summarySay(right, total, score));
      api.onSolved({ answers: next });
      return;
    }
    // The last answer's right/wrong line belongs to that question only.
    api.feedback("");
    ask();
  }, [api, ask, correct, limitMs, total]);

  const scheduleAdvance = useCallback(() => {
    stop();
    timer.current = window.setTimeout(advance, advanceMs);
  }, [advance, advanceMs]);

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
      phaseRef.current = "reveal";
      const q = next.length - 1;
      const right = pick !== null && pick === correct[q];
      const answerText = rounds[q].choices[correct[q]];
      if (right) {
        streak.current++;
        play("pop", { step: streak.current });
        api.onMove({ answers: next }, { correctStreak: streak.current });
        api.feedback(t.right(answerText), "success", "check-circle");
        api.announce(t.right(answerText));
      } else {
        streak.current = 0;
        setShakeN((k) => k + 1);
        // The mistake flag also feeds race and duel mistake counts (MatchBoard), so it stays on every miss.
        api.onMove({ answers: next }, { mistake: true });
        if (pick === null) {
          play("fizzle");
          api.feedback(t.time(answerText), "danger", "timer");
          api.announce(t.timeSay(answerText));
        } else api.ruleBreak(t.wrong(answerText));
      }
      if (!disabledRef.current) scheduleAdvance();
    },
    [api, correct, limitMs, rounds, scheduleAdvance],
  );
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // Pause with the shell: freeze the bar (or the reveal), resume where it stopped.
  useEffect(() => {
    if (phase === "reveal") {
      if (disabled) stop();
      else if (!timer.current) scheduleAdvance();
      return;
    }
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
        label: phase === "ready" ? (answers.length ? t.resume : t.start) : phase === "done" ? t.done : t.step(noun, i + 1, total),
        icon: phase === "ready" ? "play" : phase === "done" ? "flag-checkered" : "timer",
        onPress: phase === "ready" ? ask : () => {},
        tone: phase === "ready" ? "world" : "default",
        disabled: disabled || phase !== "ready",
      },
      { id: "hint", label: t.fiftyFifty, icon: "lightbulb", onPress: () => {}, tone: "gold", disabled: phase !== "asking" },
    ]);
  }, [api, ask, disabled, i, noun, phase, total, answers.length]);

  useEffect(() => {
    if (phase === "done") {
      api.feedback(t.summary(summary.right, total, summary.score), "info", "flag-checkered");
      return;
    }
    api.feedback(mode === "tutorial" ? t.introTutorial : t.intro(total, noun, Math.round(limitMs / 1000)), "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revealed = phase === "reveal" || phase === "done";
  const secsLeft = Math.ceil((phase === "asking" ? left : limitMs) / 1000);

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3.5" style={{ background: "var(--board-bg)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-[5px]" role="img" aria-label={t.answered(answers.length, total)}>
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
        {phase !== "ready" && (
          <span className="num text-muted text-[13px] font-semibold">
            {phase === "done" ? t.summaryTitle : t.step(noun, Math.min(i + 1, total), total)}
          </span>
        )}
      </div>
      {/* The question's time limit: a bar, never a second clock (the header holds the game's one clock). */}
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: "var(--surface)" }}
        role="progressbar"
        aria-label={t.timeLeft}
        aria-valuemin={0}
        aria-valuemax={Math.round(limitMs / 1000)}
        aria-valuenow={secsLeft}
      >
        <div
          ref={bar}
          className="h-full w-full origin-left rounded-full"
          style={{
            background: phase === "asking" && left <= 5000 ? "var(--gold)" : "var(--world)",
            transform: phase === "ready" ? "scaleX(1)" : phase === "done" ? "scaleX(0)" : undefined,
          }}
        />
      </div>

      <div
        className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-center"
        style={{ background: "var(--surface)" }}
      >
        {phase === "done" ? (
          <>
            <Icon name="flag-checkered" size={32} className="text-[var(--world)]" />
            <span className="num text-[24px] leading-tight font-semibold">{t.summary(summary.right, total, summary.score)}</span>
          </>
        ) : phase === "ready" ? (
          <>
            <Icon name="timer" size={36} className="text-[var(--world)]" />
            <span className="text-[16px] font-semibold">
              {answers.length ? t.resumeNext(noun, answers.length + 1, total) : t.intro(total, noun, Math.round(limitMs / 1000))}
            </span>
            {!answers.length && <span className="text-muted text-[14px]">{t.ready}</span>}
          </>
        ) : (
          <>
            {round.tag && <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">{round.tag}</span>}
            {round.prompt}
          </>
        )}
      </div>

      {phase !== "done" && (
        <div className="flex flex-col gap-2" role="group" aria-label={t.answers}>
          {phase === "ready"
            ? // Answers stay hidden until Start: empty slots keep the layout still.
              round.choices.map((_, k) => (
                <div
                  key={k}
                  aria-hidden
                  className="min-h-[52px] rounded-[14px]"
                  style={{ background: "var(--surface-raised)", opacity: 0.35 }}
                />
              ))
            : round.choices.map((c, k) => {
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
                    aria-label={`${LETTERS[k]}, ${c}${isRight ? t.rightAnswer : ""}${wrongPick ? t.yourWrongAnswer : ""}`}
                    className={`press relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-[14px] px-3 text-left disabled:cursor-default ${wrongPick ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : isRight && picked ? "cell-pop-a" : ""}`}
                    style={{
                      background: isRight ? "var(--world)" : "var(--surface-raised)",
                      color: isRight ? INK : "var(--text)",
                      boxShadow: wrongPick
                        ? "inset 0 0 0 3px var(--danger)"
                        : isRight
                          ? "0 4px 0 var(--world-depth)"
                          : "0 4px 0 var(--depth)",
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
      )}
    </div>
  );
}
