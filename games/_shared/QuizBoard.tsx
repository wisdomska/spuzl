"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BoardApi, Hint, PlayMode } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { sfx } from "@/games/_shared/sfx";
import { quick } from "@/lib/copy/quick";
import { READ_FLOOR_MS, timedMisses, timedScore, type TimedAnswer } from "./cluecave";

const INK = "#0E0F1A";
const LETTERS = ["A", "B", "C", "D"];
/** default pause on the revealed answer before the next question (Quickfire passes its game setting) */
const REVEAL_MS = 1100;
/** "Checking your answer" shows only when the judge takes longer than this */
const CHECKING_AFTER_MS = 400;
/** waits between automatic retries of a request that failed (then the player is offered Try again) */
const RETRY_WAITS = [300, 900];
const t = quick.quiz;

export interface QuizRound {
  prompt: ReactNode;
  /** plain text of the prompt for screen readers */
  say: string;
  /** small label above the prompt, e.g. a category */
  tag?: string;
  choices: string[];
}

/** An answer as the board keeps it (and autosaves): the judged pick and time, and once judged, the result. */
export interface QuizAnswer extends TimedAnswer {
  right?: boolean;
  /** the right option, shown after the answer */
  answer?: number;
}

/** A judged answer. `ms` is the time that scores (the judge's, which may differ from the board's own). */
export interface QuizVerdict {
  pick: number | null;
  ms: number;
  right: boolean;
  answer: number;
  /** the answer reached the judge after the time ran out: it counts as a timeout */
  late?: boolean;
}

/**
 * Who says whether an answer is right. Quickfire's judge is the server (games/_shared/guess.ts), so the board
 * never holds the answers; `open` starts a question's window there. A judge throws when it can't be reached.
 */
export interface QuizJudge {
  /** The question is on screen. Resolves with the time left in its window, or its verdict if already judged. */
  open(q: number): Promise<{ leftMs: number; verdict?: QuizVerdict }>;
  answer(q: number, pick: number | null, ms: number): Promise<QuizVerdict>;
}

/** A judge for boards that carry their own answer key (Flagged). */
export function localJudge(correct: number[], limitMs: number): QuizJudge {
  return {
    open: async () => ({ leftMs: limitMs }),
    answer: async (q, pick, ms) => ({
      pick,
      ms: pick === null ? limitMs : ms,
      right: pick !== null && pick === correct[q],
      answer: correct[q],
    }),
  };
}

interface Props {
  rounds: QuizRound[];
  judge: QuizJudge;
  limitMs: number;
  noun: string;
  initial?: QuizAnswer[];
  hint?: Hint | null;
  disabled?: boolean;
  mode: PlayMode;
  api: BoardApi<{ answers: QuizAnswer[] }>;
  /** how long the revealed answer stays before the next question appears on its own */
  advanceMs?: number;
}

/** checking: an answer is with the judge; retry: the judge could not be reached, the answer waits to be sent again */
type Phase = "ready" | "asking" | "checking" | "retry" | "reveal" | "done";

/** The answer key as far as the board knows it: the pick where it was judged right, -1 otherwise. */
const keyOf = (answers: QuizAnswer[]) => answers.map((a) => (a.right && a.pick !== null ? a.pick : -1));

async function withRetry<T>(f: () => Promise<T>): Promise<T> {
  for (let k = 0; ; k++) {
    try {
      return await f();
    } catch (e) {
      if (k >= RETRY_WAITS.length) throw e;
      await new Promise((ok) => window.setTimeout(ok, RETRY_WAITS[k]));
    }
  }
}

/**
 * Timed multiple choice (Quickfire, Flagged). The shell header holds the only clock; each question's
 * time limit is a world coloured bar that drains inside the card (no second mm:ss). Answers stay hidden
 * until Start. A tap marks the pick at once and goes to the judge; the right one is then shown (letter badges
 * and ticks, so never colour alone), and the next question appears on its own after `advanceMs`: there is no
 * Next button. If the judge can't be reached the pick is kept and Try again sends it. The run ends on a
 * summary ("4 of 5 · 469 pts"). The question clock is the judge's, so it keeps running through a pause.
 * Taps under the reading floor are ignored, since the server rejects them.
 */
export function QuizBoard({ rounds, judge, limitMs, noun, initial, hint, disabled, mode, api, advanceMs = REVEAL_MS }: Props) {
  const total = rounds.length;
  const [answers, setAnswers] = useState<QuizAnswer[]>(() => initial ?? []);
  const [phase, setPhase] = useState<Phase>(() => ((initial?.length ?? 0) >= total ? "done" : "ready"));
  const [left, setLeft] = useState(limitMs);
  const [shakeN, setShakeN] = useState(0);
  const [pendingPick, setPendingPick] = useState<number | null>(null);
  const answersRef = useRef(answers);
  /** performance.now() when the current question's time runs out */
  const deadline = useRef(0);
  const timer = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const streak = useRef(0);
  const opened = useRef<{ q: number; p: Promise<unknown> } | null>(null);
  const pending = useRef<{ q: number; pick: number | null; ms: number } | null>(null);
  const phaseRef = useRef(phase);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    phaseRef.current = phase;
    disabledRef.current = disabled;
  }, [phase, disabled]);
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const revealed = phase === "reveal" || phase === "done";
  const i = revealed ? Math.max(0, answers.length - 1) : answers.length;
  const round = rounds[Math.min(i, total - 1)];
  const last = answers[answers.length - 1];
  const struck = useMemo(
    () =>
      hint && typeof hint.target === "object" && hint.target && (hint.target as { question: number }).question === i && phase === "asking"
        ? (hint.target as { remove: number[] }).remove
        : [],
    [hint, i, phase],
  );
  const summary = useMemo(() => timedScore(answers, keyOf(answers), limitMs), [answers, limitMs]);

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = ticker.current = null;
  };
  useEffect(() => stop, []);
  // The time-up callback and the open's catch-up read the latest handlers (declared below).
  const commitRef = useRef<(pick: number | null) => void>(() => {});
  const settleRef = useRef<(v: QuizVerdict, q: number) => void>(() => {});

  const runClock = useCallback(() => {
    stop();
    const remaining = () => Math.max(0, deadline.current - performance.now());
    timer.current = window.setTimeout(() => commitRef.current(null), remaining());
    ticker.current = window.setInterval(() => setLeft(remaining()), 250);
  }, []);

  const ask = useCallback(() => {
    // The header clock runs from Start, not from the first answer.
    api.start?.();
    const q = answersRef.current.length;
    deadline.current = performance.now() + limitMs;
    setLeft(limitMs);
    go("asking");
    anim.current?.cancel();
    anim.current =
      bar.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
        duration: limitMs,
        easing: "linear",
        fill: "forwards",
      }) ?? null;
    runClock();
    api.announce(`${t.step(noun, q + 1, total)}. ${rounds[q].say}. ${rounds[q].choices.map((c, k) => `${LETTERS[k]}, ${c}`).join(". ")}`);
    // The judge starts the question's window now. A question it already judged (a resumed run) catches up; a
    // window that started earlier (asked before a reload) shortens the bar.
    const p = withRetry(() => judge.open(q)).then(
      (r) => {
        if (phaseRef.current !== "asking" || answersRef.current.length !== q) return;
        if (r.verdict) return settleRef.current(r.verdict, q);
        const now = performance.now();
        if (now + r.leftMs < deadline.current) {
          deadline.current = now + r.leftMs;
          if (anim.current) anim.current.currentTime = limitMs - r.leftMs;
          runClock();
        }
      },
      () => {}, // the answer opens it again if it has to
    );
    opened.current = { q, p };
  }, [api, judge, limitMs, noun, rounds, runClock, total]);

  // One advance model: the next question (or the summary) follows the reveal on its own.
  const advance = useCallback(() => {
    const next = answersRef.current;
    if (next.length >= total) {
      go("done");
      const { score, right } = timedScore(next, keyOf(next), limitMs);
      api.feedback(t.summary(right, total, score), "info", "flag-checkered");
      api.announce(t.summarySay(right, total, score));
      api.onSolved({ answers: next });
      return;
    }
    // The last answer's right/wrong line belongs to that question only.
    api.feedback("");
    ask();
  }, [api, ask, limitMs, total]);

  const scheduleAdvance = useCallback(() => {
    stop();
    timer.current = window.setTimeout(advance, advanceMs);
  }, [advance, advanceMs]);

  /** Shows a judged answer and moves on. */
  const settle = useCallback(
    (v: QuizVerdict, q: number) => {
      if (answersRef.current.length !== q) return;
      stop();
      anim.current?.pause();
      pending.current = null;
      const next = [...answersRef.current, { pick: v.pick, ms: v.ms, right: v.right, answer: v.answer }];
      answersRef.current = next;
      setAnswers(next);
      go("reveal");
      const answerText = rounds[q].choices[v.answer] ?? "";
      if (v.right) {
        streak.current++;
        // a right answer is the palette's small win (the two-note lift)
        play("success");
        api.onMove({ answers: next }, { correctStreak: streak.current });
        api.feedback(t.right(answerText), "success", "check-circle");
        api.announce(t.right(answerText));
      } else {
        streak.current = 0;
        setShakeN((k) => k + 1);
        // The mistake flag also feeds race and duel mistake counts (MatchBoard), so it stays on every miss.
        api.onMove({ answers: next }, { mistake: true });
        if (v.late) {
          sfx.miss();
          api.feedback(t.late(answerText), "danger", "timer");
          api.announce(t.late(answerText));
        } else if (v.pick === null) {
          sfx.miss();
          api.feedback(t.time(answerText), "danger", "timer");
          api.announce(t.timeSay(answerText));
        } else api.ruleBreak(t.wrong(answerText));
      }
      if (!disabledRef.current) scheduleAdvance();
    },
    [api, rounds, scheduleAdvance],
  );
  useEffect(() => {
    settleRef.current = settle;
  }, [settle]);

  /** Sends the kept answer to the judge (after its open), retrying a little before offering Try again. */
  const send = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    go("checking");
    const slow = window.setTimeout(() => api.feedback(t.checking, "info", "hourglass"), CHECKING_AFTER_MS);
    try {
      if (opened.current?.q === p.q) await opened.current.p;
      const v = await withRetry(() => judge.answer(p.q, p.pick, p.ms));
      window.clearTimeout(slow);
      if (pending.current === p) settle(v, p.q);
    } catch {
      window.clearTimeout(slow);
      if (pending.current !== p) return;
      go("retry");
      api.feedback(t.offline, "danger", "wifi-slash");
      api.announce(t.offline);
    }
  }, [api, judge, settle]);

  const commit = useCallback(
    (pick: number | null) => {
      if (phaseRef.current !== "asking") return;
      const used = limitMs - (deadline.current - performance.now());
      const ms = pick === null ? limitMs : Math.min(limitMs, Math.max(0, Math.round(used)));
      if (pick !== null && ms < READ_FLOOR_MS) return;
      stop();
      anim.current?.pause();
      // The pick shows at once; the judge's verdict follows.
      pending.current = { q: answersRef.current.length, pick, ms };
      setPendingPick(pick);
      void send();
    },
    [limitMs, send],
  );
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // Pause with the shell: the question clock is the judge's and keeps running; the reveal waits.
  useEffect(() => {
    if (phase !== "reveal") return;
    if (disabled) stop();
    else if (!timer.current) scheduleAdvance();
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
    const retrying = phase === "retry";
    api.setControls([
      {
        id: "go",
        label:
          phase === "ready"
            ? answers.length
              ? t.resume
              : t.start
            : retrying
              ? t.retry
              : phase === "done"
                ? t.done
                : t.step(noun, i + 1, total),
        icon: phase === "ready" ? "play" : retrying ? "arrow-clockwise" : phase === "done" ? "flag-checkered" : "timer",
        onPress: phase === "ready" ? ask : retrying ? () => void send() : () => {},
        tone: phase === "ready" || retrying ? "world" : "default",
        disabled: disabled || (phase !== "ready" && !retrying),
      },
      { id: "hint", label: t.fiftyFifty, icon: "lightbulb", onPress: () => {}, tone: "gold", disabled: phase !== "asking" },
    ]);
  }, [api, ask, send, disabled, i, noun, phase, total, answers.length]);

  useEffect(() => {
    // A run resumed from autosave keeps its earlier slips, so the results never call it clean.
    if (initial?.length) {
      const misses = timedMisses(initial, keyOf(initial));
      if (misses) api.restoreMistakes?.(misses);
    }
    if (phase === "done") {
      api.feedback(t.summary(summary.right, total, summary.score), "info", "flag-checkered");
      return;
    }
    api.feedback(mode === "tutorial" ? t.introTutorial : t.intro(total, noun, Math.round(limitMs / 1000)), "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waiting = phase === "checking" || phase === "retry";
  const secsLeft = Math.ceil((phase === "asking" ? left : limitMs) / 1000);

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3.5" style={{ background: "var(--board-bg)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-[5px]" role="img" aria-label={t.answered(answers.length, total)}>
          {Array.from({ length: total }, (_, k) => {
            const a = answers[k];
            const known = a && a.right !== undefined;
            return (
              <span
                key={k}
                className="flex h-4 w-4 items-center justify-center rounded-[5px]"
                style={{
                  background: !known
                    ? k === i && (phase === "asking" || waiting)
                      ? "var(--text)"
                      : "color-mix(in srgb, var(--text-muted) 30%, var(--board-bg))"
                    : a.right
                      ? "var(--world)"
                      : "var(--danger)",
                  color: INK,
                }}
              >
                {known && <Icon name={a.right ? "check" : "x"} size={11} />}
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
            <span className="text-muted text-[13px]">{t.clockRuns}</span>
          </>
        ) : (
          <>
            {round.tag && <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">{round.tag}</span>}
            {round.prompt}
          </>
        )}
      </div>

      {phase !== "done" && (
        <div className="flex flex-col gap-2" role="group" aria-label={t.answers} aria-busy={phase === "checking"}>
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
                const isRight = revealed && k === last?.answer;
                const wrongPick = picked && !isRight && last?.right === false;
                const mine = waiting && pendingPick === k;
                const gone = struck.includes(k);
                return (
                  <button
                    key={`${i}:${k}`}
                    type="button"
                    disabled={disabled || phase !== "asking" || gone}
                    onClick={() => commit(k)}
                    aria-label={`${LETTERS[k]}, ${c}${isRight ? t.rightAnswer : ""}${wrongPick ? t.yourWrongAnswer : ""}${mine ? t.yourAnswerChecking : ""}`}
                    className={`press relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-[14px] px-3 text-left disabled:cursor-default ${wrongPick ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : isRight && picked ? "cell-pop-a" : ""}`}
                    style={{
                      background: isRight ? "var(--world)" : "var(--surface-raised)",
                      color: isRight ? INK : "var(--text)",
                      boxShadow: wrongPick
                        ? "inset 0 0 0 3px var(--danger)"
                        : mine
                          ? "inset 0 0 0 3px var(--text)"
                          : isRight
                            ? "0 4px 0 var(--world-depth)"
                            : "0 4px 0 var(--depth)",
                      opacity: gone ? 0.35 : (revealed && !isRight && !picked) || (waiting && !mine) ? 0.6 : 1,
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
