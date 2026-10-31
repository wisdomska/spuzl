"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { IDLE_MS, padName, type EchoPuzzle, type EchoRound, type EchoState } from "./logic";

const INK = "#0E0F1A";
type Phase = "idle" | "watch" | "input" | "over";
/** Each pad its own note: chime steps spread across the scale */
const NOTE = [0, 2, 4, 7];
const LEAD_IN_MS = 700;
const TAP_LIGHT_MS = 160;

/**
 * Echo board (Game Boards: Echo). Four pads with circle, triangle, square and diamond shapes, a dots
 * row for the current sequence, and a glow on the lit pad. Playback lights one pad per 500 ms step
 * for 250 ms, so nothing flashes faster than 2 Hz.
 */
export default function EchoBoard({ puzzle, initialState, disabled, mode, api }: BoardProps<EchoPuzzle, EchoState>) {
  const [rounds, setRounds] = useState<EchoRound[]>(() => initialState?.rounds ?? []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState<number | null>(null);
  /** index in the sequence being shown or expected */
  const [pos, setPos] = useState(0);
  const [litN, setLitN] = useState(0);
  const [wrongPad, setWrongPad] = useState<number | null>(null);
  const roundsRef = useRef(rounds);
  const opened = useRef(0);
  const timers = useRef<number[]>([]);
  const idle = useRef<number | null>(null);
  const bestRef = useRef(0);
  const [best, setBest] = useState(0);

  const round = Math.max(0, rounds.length - (phase === "over" ? 1 : 0));
  const len = puzzle.start + Math.max(0, rounds.length - 1);
  const current = rounds[rounds.length - 1];

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = null;
  };
  useEffect(() => clearTimers, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finish = useCallback(
    (state: EchoState, why: string, tone: "danger" | "success") => {
      clearTimers();
      setLit(null);
      setPhase("over");
      const best = bestRef.current;
      if (tone === "danger") api.ruleBreak(`${why} You repeated ${best} ${best === 1 ? "step" : "steps"}.`);
      else {
        play("jingle");
        api.feedback(`${why} ${best} steps.`, "success", "check-circle");
      }
      api.announce(`Run over. Longest sequence ${best}.`);
      api.onSolved(state);
    },
    [api],
  );

  const armIdle = useCallback(() => {
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => finish({ rounds: roundsRef.current }, "Too slow.", "danger"), IDLE_MS);
  }, [finish]);

  /** Starts round `r` (0-based): plays the first start + r steps, then opens input. */
  const playRound = useCallback(
    (r: number) => {
      clearTimers();
      const n = puzzle.start + r;
      const next = [...roundsRef.current.slice(0, r), { taps: [] as [number, number][] }];
      roundsRef.current = next;
      setRounds(next);
      setPhase("watch");
      setPos(0);
      api.feedback(`Watch. Round ${r + 1}, ${n} ${n === 1 ? "step" : "steps"}.`, "info", "eye");
      api.announce(`Round ${r + 1}. Watch ${n} steps.`);
      for (let i = 0; i < n; i++) {
        const pad = puzzle.seq[i];
        later(
          () => {
            setLit(pad);
            setPos(i);
            setLitN((k) => k + 1);
            play("chime", { step: NOTE[pad] });
            api.announce(padName(pad));
          },
          LEAD_IN_MS + i * puzzle.stepMs,
        );
        later(() => setLit(null), LEAD_IN_MS + i * puzzle.stepMs + puzzle.onMs);
      }
      later(
        () => {
          setPhase("input");
          setPos(0);
          opened.current = performance.now();
          api.feedback(`Your turn, 1 of ${n}`, "info", "hand-pointing");
          api.announce(`Your turn. Repeat ${n} steps.`);
          armIdle();
        },
        LEAD_IN_MS + (n - 1) * puzzle.stepMs + puzzle.onMs + 250,
      );
    },
    [api, armIdle, puzzle],
  );

  const tap = useCallback(
    (pad: number) => {
      if (disabled || phase !== "input") return;
      const all = roundsRef.current;
      const r = all.length - 1;
      const cur = all[r];
      const n = puzzle.start + r;
      const ms = Math.max(0, Math.round(performance.now() - opened.current));
      const prevMs = cur.taps.length ? cur.taps[cur.taps.length - 1][1] : 0;
      // Taps faster than the human floor are dropped, not counted: the server would reject them.
      if (ms - prevMs < 100) return;
      const i = cur.taps.length;
      const taps = [...cur.taps, [pad, ms] as [number, number]];
      const next = [...all.slice(0, r), { taps }];
      roundsRef.current = next;
      setRounds(next);
      setLit(pad);
      setLitN((k) => k + 1);
      later(() => setLit((l) => (l === pad ? null : l)), TAP_LIGHT_MS);
      const right = puzzle.seq[i] === pad;
      const state = { rounds: next };
      if (!right) {
        setWrongPad(pad);
        api.onMove(state, { mistake: true });
        finish(state, "Wrong pad.", "danger");
        return;
      }
      play("chime", { step: NOTE[pad] });
      api.announce(`${padName(pad)}, ${i + 1} of ${n}`);
      if (i + 1 === n) {
        bestRef.current = n;
        setBest(n);
        api.onMove(state, { correctStreak: n });
        if (n >= puzzle.seq.length) {
          finish(state, "Full sequence.", "success");
          return;
        }
        if (idle.current) window.clearTimeout(idle.current);
        setPhase("watch");
        play("pop", { step: Math.min(7, r + 1) });
        api.feedback(`${n} ${n === 1 ? "step" : "steps"}. One more next round.`, "success", "check-circle");
        later(() => playRound(r + 1), 600);
      } else {
        setPos(i + 1);
        api.onMove(state, { correctStreak: i + 1 });
        api.feedback(`Your turn, ${i + 2} of ${n}`, "info", "hand-pointing");
        armIdle();
      }
    },
    [api, armIdle, disabled, finish, phase, playRound, puzzle],
  );

  const start = useCallback(() => {
    if (disabled || phase !== "idle") return;
    bestRef.current = 0;
    setBest(0);
    playRound(0);
  }, [disabled, phase, playRound]);

  // Pause or lock: stop playback and input; Resume replays the current round from the start.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && (phase === "watch" || phase === "input")) {
      setLit(null);
      setPhase("idle");
      setRounds((rs) => rs.slice(0, -1));
    }
  }
  useEffect(() => {
    if (disabled) clearTimers();
  }, [disabled]);
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  useEffect(() => {
    const resume = phase === "idle" && rounds.length > 0;
    api.setControls([
      {
        id: "start",
        label: phase === "over" ? "Run over" : phase === "watch" ? "Watch" : phase === "input" ? "Your turn" : resume ? "Resume" : "Start",
        icon: phase === "over" ? "flag-checkered" : phase === "watch" ? "eye" : phase === "input" ? "hand-tap" : "play",
        onPress: resume ? () => playRound(rounds.length) : start,
        tone: phase === "idle" ? "world" : "default",
        disabled: disabled || phase !== "idle",
      },
    ]);
  }, [api, disabled, phase, playRound, rounds.length, start]);

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Watch the pads light up, then tap them back in order." : "Press Start, then watch the pads.",
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(2, 2, tap);
  const done = current?.taps.length ?? 0;
  const dots = Array.from({ length: phase === "idle" && !rounds.length ? puzzle.start : len }, (_, i) => {
    if (phase === "watch") return i < pos || (i === pos && lit !== null) ? (i === pos ? "now" : "done") : "todo";
    if (phase === "input") return i < done ? "done" : i === done ? "now" : "todo";
    if (phase === "over") return i < done ? "done" : "todo";
    return "todo";
  });
  const status =
    phase === "watch"
      ? "Watch"
      : phase === "input"
        ? `Your turn, ${Math.min(done + 1, len)} of ${len}`
        : phase === "over"
          ? `Best ${best}`
          : rounds.length
            ? "Paused"
            : "Ready";

  return (
    <div
      className="flex w-[min(358px,calc(100vw-36px))] flex-col items-center gap-3.5 rounded-[20px] p-4"
      style={{ background: "var(--board-bg)" }}
    >
      <div className="flex max-w-full flex-wrap justify-center gap-[5px]" role="img" aria-label={`Sequence of ${len}, round ${round + 1}`}>
        {dots.map((d, i) => (
          <span
            key={i}
            className="h-3.5 w-3.5 rounded-[4px]"
            style={{
              background:
                d === "done" ? "var(--world)" : d === "now" ? "var(--text)" : "color-mix(in srgb, var(--text-muted) 30%, var(--board-bg))",
            }}
          />
        ))}
      </div>
      <div
        role="grid"
        aria-label="Echo pads"
        aria-rowcount={2}
        aria-colcount={2}
        aria-disabled={phase !== "input" || disabled}
        onKeyDown={keys.onKeyDown}
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(2, min(116px, calc((100vw - 104px) / 2)))" }}
      >
        {[0, 1].map((row) => (
          <div role="row" key={row} className="contents">
            {[0, 1].map((col) => {
              const i = row * 2 + col;
              const on = lit === i;
              const bad = phase === "over" && wrongPad === i;
              const anim = bad ? "cell-shake-a" : on ? (litN % 2 ? "cell-pop-a" : "cell-pop-b") : "";
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-label={`${padName(i)} pad${on ? ", lit" : ""}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    keys.setFocus(i);
                    tap(i);
                  }}
                  className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-[28px] outline-none ${anim}`}
                  style={{
                    background: on ? "var(--world)" : "var(--surface-raised)",
                    color: on ? INK : "color-mix(in srgb, var(--world) 70%, var(--text))",
                    boxShadow: on
                      ? "0 6px 0 var(--world-depth), 0 0 0 6px var(--text)"
                      : bad
                        ? "0 6px 0 var(--depth), inset 0 0 0 3px var(--danger)"
                        : "0 6px 0 var(--depth)",
                    opacity: phase === "watch" && !on ? 0.85 : 1,
                    transition: "background-color 80ms linear, opacity 120ms linear",
                  }}
                >
                  {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[28px]" />}
                  <Icon name={padName(i)} size={44} className="relative" />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <span className="text-[15px] font-semibold" aria-live="off">
        {status}
      </span>
    </div>
  );
}
