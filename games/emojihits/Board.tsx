"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { EMOJI_COPY as t } from "@/lib/copy/emojihits";
import { READ_FLOOR_MS, roundScore, type EmojiCheck, type EmojiPuzzle, type EmojiState, type HitTry, type RoundLog } from "./rules";

const LETTERS = ["A", "B", "C", "D"];
/** the revealed title stays this long before the next round appears on its own */
const ADVANCE_MS = 1800;
const CHECKING_AFTER_MS = 250;

type Phase = "ready" | "asking" | "reveal" | "done";
interface Outcome {
  right: boolean;
  title: string | null;
}

/**
 * Emoji Hits board (Clue Cave). Press Start; a row of emoji appears with its kind and word count, and a bar
 * drains for the round's time limit (the shell header keeps the only clock). Type the title (or pick one of
 * four on easy days); three tries per round, each wrong try is a slip. A right answer, the third miss, a skip
 * or the end of the bar reveals the title, then the next round follows on its own. Five rounds, then a summary.
 */
export default function EmojiHitsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<EmojiPuzzle, EmojiState>) {
  const total = puzzle.rounds.length;
  const [logs, setLogs] = useState<RoundLog[]>(() => initialState?.rounds?.slice() ?? []);
  const [outcomes, setOutcomes] = useState<(Outcome | null)[]>(() => (initialState?.rounds ?? []).map(() => null));
  const [tries, setTries] = useState<HitTry[]>(() => initialState?.current?.slice() ?? []);
  const [phase, setPhase] = useState<Phase>(() => ((initialState?.rounds?.length ?? 0) >= total ? "done" : "ready"));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [left, setLeft] = useState(puzzle.limitMs);
  const logsRef = useRef(logs);
  const outcomesRef = useRef(outcomes);
  const triesRef = useRef(tries);
  const phaseRef = useRef(phase);
  const disabledRef = useRef(disabled);
  const clock = useRef({ used: 0, since: 0 });
  const timer = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const streak = useRef(0);
  useEffect(() => {
    phaseRef.current = phase;
    disabledRef.current = disabled;
  }, [phase, disabled]);

  const i = Math.min(logs.length - (phase === "reveal" || phase === "done" ? 1 : 0), total - 1);
  const round = puzzle.rounds[Math.max(0, i)];
  const outcome = phase === "reveal" ? outcomes[i] : null;
  const right = outcomes.filter((o) => o?.right).length;

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (ticker.current) window.clearInterval(ticker.current);
    timer.current = ticker.current = null;
  };
  useEffect(() => stop, []);
  const usedMs = () => clock.current.used + (phaseRef.current === "asking" ? performance.now() - clock.current.since : 0);

  const stateOf = (rounds: RoundLog[], current: HitTry[]): EmojiState => (current.length ? { rounds, current } : { rounds });

  // The time-up callback and the advance read the latest versions (declared below).
  const endRef = useRef<(why: "time") => void>(() => {});

  const runClock = useCallback(
    (remaining: number) => {
      clock.current.since = performance.now();
      stop();
      timer.current = window.setTimeout(() => endRef.current("time"), remaining);
      ticker.current = window.setInterval(() => setLeft(Math.max(0, puzzle.limitMs - usedMs())), 250);
      anim.current?.play();
    },
    [puzzle.limitMs],
  );

  const ask = useCallback(() => {
    api.start?.();
    clock.current = { used: 0, since: performance.now() };
    phaseRef.current = "asking";
    setPhase("asking");
    setLeft(puzzle.limitMs);
    setText("");
    anim.current?.cancel();
    anim.current =
      bar.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
        duration: puzzle.limitMs,
        easing: "linear",
        fill: "forwards",
      }) ?? null;
    runClock(puzzle.limitMs);
    const r = puzzle.rounds[logsRef.current.length];
    api.feedback("");
    api.announce(`${t.step(logsRef.current.length + 1, total)}. ${t.clueSay(r.kind, r.words, r.emoji)}`);
    window.setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
  }, [api, puzzle.limitMs, puzzle.rounds, runClock, total]);

  const advance = useCallback(() => {
    const done = logsRef.current;
    if (done.length >= total) {
      phaseRef.current = "done";
      setPhase("done");
      anim.current?.cancel();
      play("jingle");
      const found = outcomesRef.current.filter((o) => o?.right).length;
      const pts = finalScore(puzzle, done, outcomesRef.current);
      api.feedback(t.summary(found, total, pts), "info", "flag-checkered");
      api.announce(t.summarySay(found, total, pts));
      api.onSolved({ rounds: done });
      return;
    }
    ask();
  }, [api, ask, puzzle, total]);

  const scheduleAdvance = useCallback(() => {
    stop();
    timer.current = window.setTimeout(advance, ADVANCE_MS);
  }, [advance]);

  /** Closes the round in play: logs it, shows the title, and moves on after a beat. */
  const finish = useCallback(
    async (why: "right" | "out" | "time" | "skip", title: string | null) => {
      const r = logsRef.current.length;
      const ms =
        why === "right" || why === "out" ? Math.max(READ_FLOOR_MS, Math.min(puzzle.limitMs, Math.round(usedMs()))) : puzzle.limitMs;
      stop();
      anim.current?.pause();
      const log: RoundLog = { tries: triesRef.current.slice(), ms };
      const next = [...logsRef.current, log];
      logsRef.current = next;
      triesRef.current = [];
      phaseRef.current = "reveal";
      setLogs(next);
      setTries([]);
      setText("");
      setPhase("reveal");
      const state = stateOf(next, []);
      let shown = title;
      if (why !== "right") {
        const res = await sendGuess<EmojiCheck>(puzzle.ref, { round: r, reveal: true }).catch(() => null);
        shown = res && "reveal" in res ? res.reveal : null;
      }
      const nextOutcomes = outcomesRef.current.slice();
      nextOutcomes[r] = { right: why === "right", title: shown };
      outcomesRef.current = nextOutcomes;
      setOutcomes(nextOutcomes);
      if (why === "right") {
        api.onMove(state, { correctStreak: ++streak.current });
      } else {
        streak.current = 0;
        // A wrong last try already counted its slip; time and skip are not slips.
        api.onMove(state);
        const line = shown ? (why === "time" ? t.time(shown) : why === "skip" ? t.skipped(shown) : t.out(shown)) : t.unknown;
        if (why === "time") play("fizzle");
        api.feedback(line, "danger", why === "time" ? "timer" : "x-circle");
        api.announce(line);
      }
      if (!disabledRef.current) scheduleAdvance();
    },
    [api, puzzle.limitMs, puzzle.ref, scheduleAdvance],
  );
  useEffect(() => {
    endRef.current = (why) => {
      if (phaseRef.current === "asking") void finish(why, null);
    };
  }, [finish]);

  const attempt = useCallback(
    async (answer: HitTry) => {
      if (phaseRef.current !== "asking" || busy || disabled) return;
      if (typeof answer === "string" && !answer.trim()) {
        api.feedback(t.empty, "info", "info");
        api.announce(t.empty);
        return;
      }
      // The server refuses answers faster than a person reads; a very quick one just waits for the floor.
      const early = READ_FLOOR_MS - usedMs();
      if (early > 0) await new Promise((ok) => window.setTimeout(ok, early + 20));
      if (phaseRef.current !== "asking") return;
      const r = logsRef.current.length;
      setBusy(true);
      const slow = window.setTimeout(() => api.feedback(t.checking, "info", "hourglass"), CHECKING_AFTER_MS);
      let res: EmojiCheck;
      try {
        res = await sendGuess<EmojiCheck>(puzzle.ref, { round: r, answer: typeof answer === "string" ? answer.trim() : answer });
      } catch {
        window.clearTimeout(slow);
        setBusy(false);
        api.feedback(t.offline, "danger", "wifi-slash");
        api.announce(t.offline);
        return;
      }
      window.clearTimeout(slow);
      setBusy(false);
      // The bar may have run out while the server answered.
      if (phaseRef.current !== "asking" || logsRef.current.length !== r) return;
      if ("reveal" in res || ("invalid" in res && res.invalid)) return;
      const nextTries = [...triesRef.current, typeof answer === "string" ? answer.trim() : answer];
      triesRef.current = nextTries;
      setTries(nextTries);
      if (res.ok) {
        play("pop", { step: streak.current + 1 });
        api.feedback(t.right(res.title), "success", "check-circle");
        api.announce(t.right(res.title));
        void finish("right", res.title);
        return;
      }
      setShakeN((k) => k + 1);
      setText("");
      const remaining = puzzle.tries - nextTries.length;
      if (remaining > 0) {
        api.ruleBreak(t.wrong(remaining));
        api.onMove(stateOf(logsRef.current, nextTries), { mistake: true });
        input.current?.focus({ preventScroll: true });
        return;
      }
      api.ruleBreak(t.wrong(0));
      api.onMove(stateOf(logsRef.current, nextTries), { mistake: true });
      void finish("out", null);
    },
    [api, busy, disabled, finish, puzzle.ref, puzzle.tries],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void attempt(text);
  };

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
    if (clock.current.used > 0) runClock(puzzle.limitMs - clock.current.used);
  }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.setControls([
      {
        id: "go",
        label: phase === "ready" ? (logs.length || tries.length ? t.resume : t.start) : phase === "done" ? t.done : t.step(i + 1, total),
        icon: phase === "ready" ? "play" : phase === "done" ? "flag-checkered" : "timer",
        onPress: phase === "ready" ? ask : () => {},
        tone: phase === "ready" ? "world" : "default",
        disabled: disabled || phase !== "ready",
      },
      {
        id: "skip",
        label: t.skip,
        icon: "fast-forward",
        onPress: () => {
          if (phaseRef.current === "asking") void finish("skip", null);
        },
        disabled: disabled || phase !== "asking" || busy,
      },
      { id: "hint", label: t.hint, icon: "lightbulb", onPress: () => {}, tone: "gold", disabled: phase !== "asking" },
    ]);
  }, [api, ask, busy, disabled, finish, i, logs.length, phase, total, tries.length]);

  // Resume: earlier slips stay counted, and finished rounds get their titles and results back from the server.
  useEffect(() => {
    const saved = initialState?.rounds ?? [];
    const slips = saved.reduce((a, r) => a + (Array.isArray(r.tries) ? r.tries.length : 0), 0) + (initialState?.current?.length ?? 0);
    if (!saved.length) {
      api.feedback(mode === "tutorial" ? t.introTutorial : t.intro(total, Math.round(puzzle.limitMs / 1000)), "info", "hand-pointing");
      return;
    }
    let cancelled = false;
    (async () => {
      const found: (Outcome | null)[] = [];
      let wrong = 0;
      for (let r = 0; r < saved.length; r++) {
        const last = saved[r].tries[saved[r].tries.length - 1];
        const res = last === undefined ? null : await sendGuess<EmojiCheck>(puzzle.ref, { round: r, answer: last }).catch(() => null);
        const ok = !!res && "ok" in res && res.ok;
        wrong += saved[r].tries.length - (ok ? 1 : 0);
        found.push({ right: ok, title: ok && "title" in res ? res.title : null });
      }
      if (cancelled) return;
      outcomesRef.current = found;
      setOutcomes(found);
      api.restoreMistakes?.(Math.min(slips, wrong + (initialState?.current?.length ?? 0)));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hinted = hint && (hint.target as { round?: number } | null)?.round === i && phase === "asking";
  const secsLeft = Math.ceil((phase === "asking" ? left : puzzle.limitMs) / 1000);
  const triesLeft = puzzle.tries - tries.length;
  const wrongPicks = tries.filter((x): x is number => typeof x === "number");
  const off = disabled || busy || phase !== "asking";

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3.5" style={{ background: "var(--board-bg)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex gap-[5px]" role="img" aria-label={t.answered(logs.length, total)}>
          {Array.from({ length: total }, (_, k) => {
            const o = outcomes[k];
            const played = k < logs.length;
            return (
              <span
                key={k}
                className="flex h-4 w-4 items-center justify-center rounded-[5px]"
                style={{
                  background: !played
                    ? k === i && phase === "asking"
                      ? "var(--text)"
                      : "color-mix(in srgb, var(--text-muted) 30%, var(--board-bg))"
                    : o?.right
                      ? "var(--world)"
                      : "var(--danger)",
                  color: "var(--on-accent)",
                }}
              >
                {played && <Icon name={o?.right ? "check" : "x"} size={11} />}
              </span>
            );
          })}
        </div>
        <span className="flex-1" />
        {phase !== "ready" && (
          <span className="num text-muted text-[13px] font-semibold">{phase === "done" ? t.summaryTitle : t.step(i + 1, total)}</span>
        )}
      </div>

      {/* The round's time limit: a bar, never a second clock. */}
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: "var(--surface)" }}
        role="progressbar"
        aria-label={t.timeLeft}
        aria-valuemin={0}
        aria-valuemax={Math.round(puzzle.limitMs / 1000)}
        aria-valuenow={secsLeft}
      >
        <div
          ref={bar}
          className="h-full w-full origin-left rounded-full"
          style={{
            background: phase === "asking" && left <= 10000 ? "var(--gold)" : "var(--world)",
            transform: phase === "ready" ? "scaleX(1)" : phase === "done" ? "scaleX(0)" : undefined,
          }}
        />
      </div>

      <div
        className={`flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-[16px] px-3 py-4 text-center ${hinted ? "hint-ring" : ""}`}
        style={{ background: "var(--surface)", boxShadow: hinted ? "inset 0 0 0 3px var(--gold)" : undefined }}
      >
        {phase === "done" ? (
          <>
            <Icon name="flag-checkered" size={32} className="text-[var(--world)]" />
            <span className="num text-[24px] leading-tight font-semibold" role="status">
              {t.summary(right, total, finalScore(puzzle, logs, outcomes))}
            </span>
          </>
        ) : phase === "ready" ? (
          <>
            <Icon name="smiley" size={36} className="text-[var(--world)]" />
            <span className="text-[16px] font-semibold">
              {logs.length || tries.length ? t.resumeNext(logs.length + 1, total) : t.intro(total, Math.round(puzzle.limitMs / 1000))}
            </span>
            {!logs.length && <span className="text-muted text-[14px]">{t.ready}</span>}
          </>
        ) : (
          <>
            <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">{t.kindLine(round.kind, round.words)}</span>
            <span
              role="img"
              aria-label={t.clueSay(round.kind, round.words, round.emoji)}
              className={`text-[44px] leading-[1.15] tracking-[0.06em] ${shakeN && phase === "asking" ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
            >
              {round.emoji}
            </span>
            {outcome && (
              <span className="flex items-center gap-1.5 text-[17px] font-bold" role="status">
                <Icon
                  name={outcome.right ? "check-circle" : "x-circle"}
                  size={20}
                  className={outcome.right ? "text-[var(--world)]" : "text-[var(--danger)]"}
                />
                {outcome.title ?? ""}
              </span>
            )}
          </>
        )}
      </div>

      {phase !== "done" && (
        <>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              ref={input}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={off}
              aria-label={t.inputLabel}
              placeholder={phase === "asking" ? t.inputPlaceholder : ""}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={80}
              className="h-12 min-w-0 flex-1 rounded-[14px] px-3 font-semibold outline-none disabled:opacity-50"
              style={{ background: "var(--surface-raised)", color: "var(--text)", boxShadow: "inset 0 0 0 2px var(--line)" }}
            />
            <button
              type="submit"
              disabled={off || !text.trim()}
              className="toy h-12 flex-none rounded-[14px] px-4 text-[16px] font-bold disabled:opacity-50"
              style={{ background: "var(--world)", color: "var(--on-accent)", boxShadow: "0 3px 0 var(--world-depth)" }}
            >
              {t.guess}
            </button>
          </form>
          <div className="text-muted flex items-center justify-between text-[13px] font-medium">
            <span>{phase === "asking" ? t.triesLeft(triesLeft) : ""}</span>
            <span className="flex gap-[5px]" aria-hidden>
              {Array.from({ length: puzzle.tries }, (_, k) => (
                <span
                  key={k}
                  className="size-3 rounded-full"
                  style={k < triesLeft ? { background: "var(--world)" } : { boxShadow: "inset 0 0 0 2px var(--line)" }}
                />
              ))}
            </span>
          </div>
          {round.options && phase !== "ready" && (
            <div className="flex flex-col gap-2" role="group" aria-label={t.options}>
              {round.options.map((c, k) => {
                const tried = phase === "asking" && wrongPicks.includes(k);
                const isRight = phase === "reveal" && !!outcome?.title && c === outcome.title;
                return (
                  <button
                    key={`${i}:${k}`}
                    type="button"
                    disabled={off || tried}
                    onClick={() => void attempt(k)}
                    aria-label={t.optionSay(LETTERS[k], c, tried ? "wrong" : isRight ? "right" : "")}
                    className="press relative flex min-h-[48px] items-center gap-3 overflow-hidden rounded-[14px] px-3 text-left disabled:cursor-default"
                    style={{
                      background: isRight ? "var(--world)" : "var(--surface-raised)",
                      color: isRight ? "var(--on-accent)" : "var(--text)",
                      boxShadow: tried ? "inset 0 0 0 3px var(--danger)" : isRight ? "0 4px 0 var(--world-depth)" : "0 4px 0 var(--depth)",
                      opacity: tried ? 0.6 : 1,
                    }}
                  >
                    {tried && <span aria-hidden className="hatch absolute inset-0" />}
                    <span
                      aria-hidden
                      className="relative flex h-7 w-7 flex-none items-center justify-center rounded-[8px] font-mono text-[13px] font-semibold"
                      style={{ background: isRight ? "color-mix(in srgb, var(--on-accent) 15%, transparent)" : "var(--surface)" }}
                    >
                      {isRight ? <Icon name="check" size={14} /> : tried ? <Icon name="x" size={14} /> : LETTERS[k]}
                    </span>
                    <span aria-hidden className={`relative text-[16px] font-semibold ${tried ? "line-through" : ""}`}>
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The server's score (logic.ts scoreOf), from what the board knows: titles found, wrong tries, time. */
function finalScore(p: EmojiPuzzle, logs: RoundLog[], outcomes: (Outcome | null)[]): number {
  return logs.reduce((a, log, k) => (outcomes[k]?.right ? a + roundScore(log.tries.length - 1, log.ms, p.limitMs) : a), 0);
}
