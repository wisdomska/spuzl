"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { useGameSettings } from "@/lib/game-settings/client";
import { logicGames } from "@/lib/copy/logic-games";
import { classify, FALSE_START_PENALTY, pointsFor, tally, type FlinchPuzzle, type FlinchRound, type FlinchState } from "./logic";

const t = logicGames.flinch;
const INK = "#0E0F1A";
type Phase = "ready" | "armed" | "go" | "result" | "over";

/* The auto-start bar fills once over the wait (transform only). Reduced motion shows it full and still. */
const CSS = `
@keyframes flinch-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.flinch-fill { transform-origin: left center; animation: flinch-fill var(--flinch-wait) linear both; }
[data-motion="reduce"] .flinch-fill { animation: none; transform: none; }
@media (prefers-reduced-motion: reduce) { .flinch-fill { animation: none; transform: none; } }
`;

/**
 * Flinch board. One big pad: tap to arm a round, wait while it reads "Wait" (open hand, dashed
 * frame), tap the moment it changes to "Tap!" (lightning glyph, solid frame, world colour). The
 * signal never relies on colour alone: text, glyph and frame all change. The change is a single
 * solid fill once per round (at least 1.5 s after arming), never a strobe. Early taps hatch the pad
 * and cost points. After a round the next one starts on its own after `flinch.autoStartMs`; a tap
 * skips the wait.
 */
export default function FlinchBoard({ puzzle, initialState, disabled, mode, api }: BoardProps<FlinchPuzzle, FlinchState>) {
  const total = puzzle.delays.length;
  const autoStartMs = useGameSettings()["flinch.autoStartMs"];
  const [rounds, setRounds] = useState<FlinchRound[]>(() => initialState?.rounds ?? []);
  const [phase, setPhase] = useState<Phase>(() => ((initialState?.rounds.length ?? 0) >= total ? "over" : "ready"));
  const [last, setLast] = useState<FlinchRound | null>(null);
  const [shakeN, setShakeN] = useState(0);
  const roundsRef = useRef(rounds);
  const armedAt = useRef(0);
  const resultAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const record = useCallback(
    (r: FlinchRound) => {
      clear();
      resultAt.current = performance.now();
      const next = [...roundsRef.current, r];
      roundsRef.current = next;
      setRounds(next);
      setLast(r);
      const state = { rounds: next };
      const i = next.length;
      const kind = classify(puzzle.delays[i - 1], r.tapAt, puzzle.window);
      if (kind === "early") {
        setShakeN((k) => k + 1);
        api.onMove(state, { mistake: true });
        api.ruleBreak(t.falseStart(FALSE_START_PENALTY));
      } else if (kind === "timeout") {
        api.onMove(state, { mistake: true });
        play("fizzle");
        api.feedback(t.timeout, "danger", "timer");
        api.announce(t.timeoutAnnounce);
      } else {
        api.onMove(state, { correctStreak: i });
        play("pop", { step: Math.min(7, Math.max(0, Math.round((400 - r.reaction!) / 40))) });
        api.feedback(t.reaction(r.reaction!, i, total), "info", "lightning");
        api.announce(t.reactionAnnounce(r.reaction!, i < total));
      }
      if (i >= total) {
        setPhase("over");
        const tl = tally(puzzle, state);
        timers.current.push(
          window.setTimeout(() => {
            play("jingle");
            api.feedback(t.done(tl.best, tl.score), "success", "check-circle");
            api.onSolved(state);
          }, 700),
        );
      } else setPhase("result");
    },
    [api, puzzle, total],
  );

  const arm = useCallback(() => {
    const i = roundsRef.current.length;
    if (i >= total) return;
    clear();
    setPhase("armed");
    setLast(null);
    armedAt.current = performance.now();
    play("tick");
    api.announce(t.armAnnounce(i + 1));
    const delay = puzzle.delays[i];
    timers.current.push(
      window.setTimeout(() => {
        setPhase("go");
        api.announce(t.goAnnounce);
      }, delay),
    );
    timers.current.push(window.setTimeout(() => record({ tapAt: null, reaction: null }), delay + puzzle.window + 50));
  }, [api, puzzle, record, total]);

  // Auto-start: after a round's result the next one arms itself (tap to skip). Paused or locked: no
  // countdown; it starts again from the full wait once play resumes.
  useEffect(() => {
    if (phase !== "result" || disabled) return;
    const id = window.setTimeout(arm, autoStartMs);
    return () => window.clearTimeout(id);
  }, [phase, disabled, arm, autoStartMs, rounds.length]);

  const press = useCallback(
    (at: number) => {
      if (disabled) return;
      // A double tap on the result should not arm the next round by accident.
      if (phase === "ready" || (phase === "result" && at - resultAt.current > 600)) return arm();
      if (phase !== "armed" && phase !== "go") return;
      const i = roundsRef.current.length;
      const tapAt = Math.max(0, Math.round(at - armedAt.current));
      const kind = classify(puzzle.delays[i], tapAt, puzzle.window);
      record({ tapAt, reaction: kind === "valid" ? tapAt - puzzle.delays[i] : null });
    },
    [arm, disabled, phase, puzzle, record],
  );

  // Pause or lock mid round: the round is void and re-armed on the next tap.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && (phase === "armed" || phase === "go")) setPhase("ready");
  }
  useEffect(() => {
    if (disabled && roundsRef.current.length < total) clear();
  }, [disabled, total]);

  useEffect(() => {
    api.setControls([
      {
        id: "go",
        label: phase === "over" ? "Done" : phase === "armed" || phase === "go" ? "Tap the pad" : rounds.length ? "Next round" : "Start",
        icon: phase === "over" ? "flag-checkered" : "hand-tap",
        onPress: () => (phase === "ready" || phase === "result" ? arm() : undefined),
        tone: phase === "ready" || phase === "result" ? "world" : "default",
        disabled: disabled || !(phase === "ready" || phase === "result"),
      },
    ]);
  }, [api, arm, disabled, phase, rounds.length]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? t.tutorial : t.intro(total, FALSE_START_PENALTY), "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = phase === "go";
  const armed = phase === "armed";
  const counting = phase === "result" && !disabled;
  const early = last && classify(puzzle.delays[rounds.length - 1], last.tapAt, puzzle.window) === "early";
  const look = go
    ? { bg: "var(--world)", fg: INK, icon: "lightning", big: t.go, small: t.goSmall }
    : armed
      ? { bg: "var(--surface)", fg: "var(--text)", icon: "hand-palm", big: t.wait, small: t.waitSmall }
      : phase === "over"
        ? {
            bg: "var(--surface-raised)",
            fg: "var(--text)",
            icon: "flag-checkered",
            big: `${tally(puzzle, { rounds }).score}`,
            small: t.score,
          }
        : last
          ? last.reaction !== null
            ? {
                bg: "var(--surface-raised)",
                fg: "var(--text)",
                icon: "lightning",
                big: `${last.reaction} ms`,
                small: t.nextSoon,
              }
            : {
                bg: "var(--surface-raised)",
                fg: "var(--text)",
                icon: early ? "warning" : "timer",
                big: early ? t.tooSoon : t.tooSlow,
                small: t.nextSoon,
              }
          : {
              bg: "var(--surface-raised)",
              fg: "var(--text)",
              icon: "hand-tap",
              big: t.ready,
              small: t.readySmall(rounds.length + 1),
            };

  // Frame: dashed while waiting, a thick solid ring on "Tap!" (shape cue on top of colour and text).
  const frame = go ? `inset 0 0 0 8px ${INK}` : "";
  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3" style={{ background: "var(--board-bg)" }}>
      <style href="spuzl-flinch" precedence="default">
        {CSS}
      </style>
      <button
        type="button"
        aria-label={`${look.big}. ${look.small}`}
        aria-live="off"
        data-phase={phase}
        disabled={disabled || phase === "over"}
        onPointerDown={(e) => {
          e.preventDefault();
          press(performance.now());
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!e.repeat) press(performance.now());
          }
        }}
        className={`relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-[28px] outline-none ${early && phase === "result" ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
        style={{
          background: look.bg,
          color: look.fg,
          boxShadow: [
            early && phase === "result" ? "inset 0 0 0 3px var(--danger)" : frame,
            go ? "0 6px 0 var(--world-depth)" : "0 6px 0 var(--depth)",
          ]
            .filter(Boolean)
            .join(", "),
          touchAction: "manipulation",
        }}
      >
        {early && phase === "result" && <span aria-hidden className="hatch absolute inset-0" />}
        {armed && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-3 rounded-[20px] border-2 border-dashed"
            style={{ borderColor: "var(--line)" }}
          />
        )}
        <Icon name={look.icon} size={go ? 96 : 64} className="relative" />
        <span className={`font-display relative font-black ${go ? "text-[48px] uppercase" : "text-[32px]"}`}>{look.big}</span>
        <span className="relative text-[15px] font-medium" style={{ color: go ? INK : "var(--text-muted)" }}>
          {look.small}
        </span>
        {counting && (
          <span aria-hidden className="absolute inset-x-6 bottom-4 h-1 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
            <span
              key={rounds.length}
              className="flinch-fill block h-full w-full rounded-full"
              style={{ background: "var(--text-muted)", ["--flinch-wait" as string]: `${autoStartMs}ms` }}
            />
          </span>
        )}
      </button>
      <ol
        className="m-0 grid list-none gap-1.5 p-0"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        aria-label="Rounds"
      >
        {Array.from({ length: total }, (_, i) => {
          const r = rounds[i];
          const kind = r ? classify(puzzle.delays[i], r.tapAt, puzzle.window) : null;
          const text = !r ? `${i + 1}` : kind === "valid" ? `${r.reaction}` : kind === "early" ? "Early" : "Slow";
          return (
            <li
              key={i}
              className="num flex h-11 flex-col items-center justify-center rounded-[12px] font-mono text-[13px] font-semibold"
              aria-label={
                !r
                  ? `Round ${i + 1}, not played`
                  : kind === "valid"
                    ? `Round ${i + 1}, ${r.reaction} milliseconds, ${pointsFor(r.reaction!)} points`
                    : `Round ${i + 1}, ${text}`
              }
              style={{
                background: kind === "valid" ? "var(--world)" : "var(--surface)",
                color: kind === "valid" ? INK : kind ? "var(--danger)" : "var(--text-muted)",
                boxShadow: kind && kind !== "valid" ? "inset 0 0 0 2px var(--danger)" : undefined,
              }}
            >
              {kind && kind !== "valid" && <Icon name="x" size={12} />}
              {text}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
