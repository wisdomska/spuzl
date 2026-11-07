"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { play } from "@/lib/audio";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { ARROW_NAME, azonto as t, MOVE_NAME } from "@/lib/copy/azonto";
import { COUNT_IN, IDLE_MS, MOVE_DEFS, moveForKey, TAP_FLOOR_MS, type AzontoPuzzle, type AzontoRound, type AzontoState } from "./rules";

const INK = "#0E0F1A";
type Phase = "idle" | "watch" | "input" | "over";
/** Each move its own note (chime steps across the scale). */
const NOTE = [0, 2, 4, 7];
const TAP_LIGHT_MS = 160;
/** Spuz's pose per move: a sway for Iron and Wash, a lean up for the phone call, a bob down for Boxing. */
const POSE = [
  { rotate: -12, x: -10, y: 0 },
  { rotate: 8, x: 0, y: -10 },
  { rotate: 12, x: 10, y: 0 },
  { rotate: 0, x: 0, y: 8 },
] as const;
const REST = { rotate: 0, x: 0, y: 0 };

const nameOf = (m: number) => MOVE_NAME[MOVE_DEFS[m].id];

/** The longest round repeated in full in a saved run. */
function bestOf(p: AzontoPuzzle, rounds: AzontoRound[]): number {
  let best = 0;
  rounds.forEach((r, i) => {
    const n = p.start + i;
    if (r?.taps?.length === n && r.taps.every(([m], k) => m === p.seq[k])) best = n;
  });
  return best;
}

/**
 * Azonto Steps board (R2-P5). Spuz dances each move of the round on the beat (a soft count-in tick first, then a
 * tick and the move's note per beat), with the move's name, arrow and shape in a bubble beside him; then the
 * player repeats the moves on a 2 × 2 pad of real buttons (keys 1 to 4 or the arrows). Every round adds one move.
 * Nothing pulses faster than 2 Hz (beats are at least 500 ms). With reduced motion Spuz stands still and the
 * bubble's highlighted label carries the dance. The run ends on a wrong move, the idle limit or the whole dance;
 * the move log goes to the server, which replays it against the seeded sequence.
 */
export default function AzontoBoard({ puzzle, initialState, disabled, mode, api }: BoardProps<AzontoPuzzle, AzontoState>) {
  const reduce = prefersReducedMotion({ reducedMotion: useSettings((s) => s.reducedMotion) });
  const [rounds, setRounds] = useState<AzontoRound[]>(() => initialState?.rounds ?? []);
  const [phase, setPhase] = useState<Phase>("idle");
  /** the move lit now (demonstrated or just tapped) */
  const [lit, setLit] = useState<number | null>(null);
  const [litN, setLitN] = useState(0);
  /** position in the sequence being shown or expected */
  const [pos, setPos] = useState(0);
  const [wrongMove, setWrongMove] = useState<number | null>(null);
  // A resumed run keeps the longest sequence it already repeated.
  const [best, setBest] = useState(() => bestOf(puzzle, initialState?.rounds ?? []));
  const roundsRef = useRef(rounds);
  const phaseRef = useRef(phase);
  const opened = useRef(0);
  const timers = useRef<number[]>([]);
  const idle = useRef<number | null>(null);
  const bestRef = useRef(best);

  const len = puzzle.start + Math.max(0, rounds.length - 1);
  const current = rounds[rounds.length - 1];

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const clearTimers = () => {
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = null;
  };
  useEffect(() => clearTimers, []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finish = useCallback(
    (state: AzontoState, line: string, tone: "danger" | "success") => {
      clearTimers();
      setLit(null);
      go("over");
      if (tone === "danger") api.ruleBreak(line);
      else api.feedback(line, "success", "check-circle");
      api.announce(t.over(bestRef.current));
      // after a slip, let the buzz finish before the run's closing phrase
      api.onSolved(state, tone === "danger" ? { clearDelayMs: 420 } : undefined);
    },
    [api],
  );

  const armIdle = useCallback(() => {
    if (idle.current) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => finish({ rounds: roundsRef.current }, t.slow(bestRef.current), "danger"), IDLE_MS);
  }, [finish]);

  /** Round `r` (0-based): a count-in, Spuz dances the first start + r moves on the beat, then input opens. */
  const playRound = useCallback(
    (r: number) => {
      clearTimers();
      const n = puzzle.start + r;
      const next = [...roundsRef.current.slice(0, r), { taps: [] as [number, number][] }];
      roundsRef.current = next;
      setRounds(next);
      go("watch");
      setPos(0);
      setLit(null);
      api.feedback(t.watchRound(r + 1, n), "info", "eye");
      api.announce(t.watchSay(r + 1, n));
      const beat = puzzle.beatMs;
      // The count-in: soft ticks on the beat (Beat Tap's lead-in), so the dance starts in time.
      for (let k = 0; k < COUNT_IN; k++) later(() => play("tick", { gain: 0.6, silentHaptic: true }), k * beat);
      const lead = COUNT_IN * beat;
      for (let i = 0; i < n; i++) {
        const m = puzzle.seq[i];
        later(
          () => {
            setLit(m);
            setPos(i);
            setLitN((k) => k + 1);
            play("tick", { gain: 0.5, silentHaptic: true });
            play("chime", { step: NOTE[m] });
            api.announce(nameOf(m));
          },
          lead + i * beat,
        );
        later(() => setLit(null), lead + i * beat + puzzle.onMs);
      }
      later(
        () => {
          go("input");
          setPos(0);
          opened.current = performance.now();
          api.feedback(t.turn(1, n), "info", "hand-pointing");
          api.announce(t.turnSay(n));
          armIdle();
        },
        lead + (n - 1) * beat + puzzle.onMs + 250,
      );
    },
    [api, armIdle, puzzle],
  );

  const tap = useCallback(
    (m: number) => {
      if (disabled || phaseRef.current !== "input") return;
      const all = roundsRef.current;
      const r = all.length - 1;
      const cur = all[r];
      const n = puzzle.start + r;
      const ms = Math.max(0, Math.round(performance.now() - opened.current));
      const prevMs = cur.taps.length ? cur.taps[cur.taps.length - 1][1] : 0;
      // Taps faster than the human floor are dropped, not counted: the server would reject them.
      if (ms - prevMs < TAP_FLOOR_MS) return;
      const i = cur.taps.length;
      const taps = [...cur.taps, [m, ms] as [number, number]];
      const next = [...all.slice(0, r), { taps }];
      roundsRef.current = next;
      setRounds(next);
      setLit(m);
      setLitN((k) => k + 1);
      later(() => setLit((l) => (l === m ? null : l)), TAP_LIGHT_MS);
      const state = { rounds: next };
      const expected = puzzle.seq[i];
      if (expected !== m) {
        setWrongMove(m);
        api.onMove(state, { mistake: true });
        finish(state, t.wrong(nameOf(expected), bestRef.current), "danger");
        return;
      }
      play("chime", { step: NOTE[m] });
      api.announce(t.moveSay(nameOf(m), i + 1, n));
      if (i + 1 === n) {
        bestRef.current = n;
        setBest(n);
        api.onMove(state, { correctStreak: n });
        if (n >= puzzle.seq.length) return finish(state, t.full(n), "success");
        if (idle.current) window.clearTimeout(idle.current);
        go("watch");
        // the round repeated: the small win, after the last move's note
        play("success", { delay: 0.12 });
        api.feedback(t.roundDone(n), "success", "check-circle");
        later(() => playRound(r + 1), 700);
      } else {
        setPos(i + 1);
        api.onMove(state, { correctStreak: i + 1 });
        api.feedback(t.turn(i + 2, n), "info", "hand-pointing");
        armIdle();
      }
    },
    [api, armIdle, disabled, finish, playRound, puzzle],
  );

  const start = useCallback(() => {
    if (disabled || phaseRef.current !== "idle") return;
    // Start is the first move: the shell clock runs from here.
    api.start?.();
    if (roundsRef.current.length) return playRound(roundsRef.current.length - 1);
    playRound(0);
  }, [api, disabled, playRound]);

  // Pause or lock: stop the dance and input; Resume replays the current round from its count-in.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && (phase === "watch" || phase === "input")) {
      setLit(null);
      setPhase("idle");
      setRounds((rs) => (rs.length ? [...rs.slice(0, -1), { taps: [] as [number, number][] }] : rs));
    }
  }
  useEffect(() => {
    if (disabled) clearTimers();
  }, [disabled]);
  // The handlers read the latest phase and rounds (a pause above changes them during render).
  useEffect(() => {
    phaseRef.current = phase;
    roundsRef.current = rounds;
  }, [phase, rounds]);

  // Keys 1 to 4 and the arrows play a move (the arrows never scroll the page while it is your turn).
  useEffect(() => {
    if (phase !== "input" || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const m = moveForKey(e.key);
      if (m === null) return;
      e.preventDefault();
      tap(m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, phase, tap]);

  useEffect(() => {
    const resume = phase === "idle" && rounds.length > 0;
    api.setControls([
      {
        id: "start",
        label: phase === "over" ? t.runOver : phase === "watch" ? t.watch : phase === "input" ? t.yourTurn : resume ? t.resume : t.start,
        icon: phase === "over" ? "flag-checkered" : phase === "watch" ? "eye" : phase === "input" ? "hand-tap" : "play",
        onPress: start,
        tone: phase === "idle" ? "world" : "default",
        disabled: disabled || phase !== "idle",
      },
    ]);
  }, [api, disabled, phase, rounds.length, start]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? t.introTutorial : t.intro, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = current?.taps.length ?? 0;
  const dots = Array.from({ length: phase === "idle" && !rounds.length ? puzzle.start : len }, (_, i) => {
    if (phase === "watch") return i < pos || (i === pos && lit !== null) ? (i === pos ? "now" : "done") : "todo";
    if (phase === "input") return i < done ? "done" : i === done ? "now" : "todo";
    if (phase === "over") return i < done ? "done" : "todo";
    return "todo";
  });
  const status =
    phase === "watch"
      ? t.watch
      : phase === "input"
        ? t.status(Math.min(done + 1, len), len)
        : phase === "over"
          ? t.best(best)
          : rounds.length
            ? t.paused
            : t.ready;
  const dancing = phase === "watch" && lit !== null;
  const pose = dancing && !reduce ? POSE[lit] : REST;
  const shown = lit !== null ? MOVE_DEFS[lit] : null;

  return (
    <div
      className="flex w-[min(358px,calc(100vw-36px))] flex-col items-center gap-3 rounded-[20px] p-4"
      style={{ background: "var(--board-bg)" }}
    >
      {/* Spuz's dance floor: Spuz and the move bubble (name, arrow and shape; highlighted while a move shows). */}
      <div className="flex w-full items-center gap-3" role="group" aria-label={t.stage}>
        <motion.div
          aria-hidden
          className="flex-none"
          animate={pose}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 18 }}
        >
          <Spuz
            size={84}
            mood={phase === "over" ? (wrongMove !== null ? "sad" : "cheer") : dancing ? "party" : "idle"}
            still={reduce}
            decorative
          />
        </motion.div>
        <div
          data-now={shown?.id ?? "none"}
          className="flex min-h-[64px] min-w-0 flex-1 items-center gap-2 rounded-[16px] px-3 py-2"
          style={{
            background: shown ? "var(--world)" : "var(--surface)",
            color: shown ? INK : "var(--text-muted)",
            boxShadow: shown && reduce ? "0 0 0 3px var(--text)" : undefined,
          }}
        >
          {shown ? (
            <>
              <Icon name={`arrow-${shown.arrow}`} size={22} className="flex-none" />
              <Icon name={shown.shape} size={18} className="flex-none" />
              <span className="min-w-0 text-[20px] leading-tight font-extrabold">{t.nowMove(MOVE_NAME[shown.id])}</span>
            </>
          ) : (
            <span className="text-[14px] font-semibold">{t.idle}</span>
          )}
        </div>
      </div>

      <div
        className="flex max-w-full flex-wrap justify-center gap-[5px]"
        role="img"
        aria-label={t.sequence(len, Math.max(1, rounds.length))}
      >
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

      <div className="grid w-full grid-cols-2 gap-3" role="group" aria-label={t.pad} aria-disabled={phase !== "input" || disabled}>
        {MOVE_DEFS.map((def, m) => {
          const on = lit === m;
          const bad = phase === "over" && wrongMove === m;
          const name = MOVE_NAME[def.id];
          return (
            <button
              key={def.id}
              type="button"
              data-move={def.id}
              disabled={disabled || phase !== "input"}
              onClick={() => tap(m)}
              aria-label={t.moveLabel(name, ARROW_NAME[def.arrow], def.key, on)}
              className={`press relative flex min-h-[84px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[20px] px-2 py-2 disabled:cursor-default ${
                bad ? "cell-shake-a" : on && !reduce ? (litN % 2 ? "cell-pop-a" : "cell-pop-b") : ""
              }`}
              style={{
                background: on ? "var(--world)" : "var(--surface-raised)",
                color: on ? INK : "var(--text)",
                boxShadow: on
                  ? "0 5px 0 var(--world-depth), 0 0 0 4px var(--text)"
                  : bad
                    ? "0 5px 0 var(--depth), inset 0 0 0 3px var(--danger)"
                    : "0 5px 0 var(--depth)",
                opacity: phase === "watch" && !on ? 0.85 : 1,
              }}
            >
              {bad && <span aria-hidden className="hatch absolute inset-0" />}
              <span aria-hidden className="relative flex items-center gap-1.5">
                <Icon name={`arrow-${def.arrow}`} size={20} />
                <Icon name={def.shape} size={16} />
              </span>
              <span className="relative text-[16px] font-bold">{name}</span>
              <span aria-hidden className="text-muted absolute top-1.5 right-2.5 font-mono text-[12px] font-semibold">
                {def.key}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-[15px] font-semibold" aria-live="off">
          {status}
        </span>
        <span className="text-muted text-[12px]">{t.keysHint}</span>
      </div>
    </div>
  );
}
