"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BoardApi, BoardProps, ControlSpec, FeedbackTone, Hint, PlayMode } from "@/games/types";
import type { GameMeta } from "@/lib/catalog";
import { WORLD_BY_ID } from "@/lib/catalog";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { useSettings } from "@/lib/settings/store";
import { play } from "@/lib/audio";
import { formatClock } from "@/lib/format";
import { PauseOverlay } from "./PauseOverlay";

/**
 * The reusable 6-zone board template (Game Boards file):
 * 1 top bar, 2 optional strip, 3 title + rule, 4 board slot, 5 feedback line, 6 controls.
 * The shell owns timer, hints, pause, help, feedback and live-region announcements. Boards only
 * render the puzzle and report moves; the parent decides what a clear means (server verifies).
 */
export interface GameShellProps<P, St> {
  meta: GameMeta;
  Board: ComponentType<BoardProps<P, St>>;
  puzzle: P;
  mode: PlayMode;
  /** right meta in the title row, e.g. "Daily #214" */
  label: string;
  initialState?: St;
  hintsLeft?: number;
  /** server hint for the current state */
  requestHint?: (state: St | undefined) => Promise<Hint | null>;
  /** board reports solved; resolves when the server has decided */
  onSolved: (state: St, elapsedMs: number, stats: { hints: number; mistakes: number }) => Promise<void> | void;
  onFailed?: (state: St, reason: string, elapsedMs: number) => void;
  onMove?: (state: St, elapsedMs: number, info?: { correctStreak?: number; mistake?: boolean }) => void;
  onExit: () => void;
  onHelp?: () => void;
  /** zone 2: opponent strip, race rail or ghost HUD */
  strip?: ReactNode;
  /** locks input (countdown, opponent finished) */
  locked?: boolean;
  /** a key that changes per puzzle so the board remounts (free play next puzzle) */
  puzzleKey?: string | number;
}

interface FeedbackState {
  text: string;
  tone: FeedbackTone;
  icon?: string;
  n: number;
}

export function GameShell<P, St>(props: GameShellProps<P, St>) {
  const {
    meta,
    Board,
    puzzle,
    mode,
    label,
    initialState,
    hintsLeft = 3,
    requestHint,
    onSolved,
    onFailed,
    onMove,
    onExit,
    onHelp,
    strip,
    locked,
    puzzleKey,
  } = props;
  const world = WORLD_BY_ID[meta.world];
  const relaxed = useSettings((s) => s.relaxed);

  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hints, setHints] = useState(hintsLeft);
  const [hint, setHint] = useState<Hint | null>(null);
  const [controls, setControls] = useState<ControlSpec[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ text: "", tone: "info", n: 0 });
  const [live, setLive] = useState("");
  const stateRef = useRef<St | undefined>(initialState);
  const mistakes = useRef(0);
  const hintsUsed = useRef(0);
  const clock = useRef({ base: 0, since: 0 });

  // Timer: starts on first interaction, stops while paused or hidden (FR-GP-02).
  const running = started && !paused && !solved;
  useEffect(() => {
    if (!running) return;
    const c = clock.current; // one mutable clock for the shell's lifetime
    c.since = performance.now();
    const id = setInterval(() => setElapsed(c.base + performance.now() - c.since), 200);
    return () => {
      c.base += performance.now() - c.since;
      clearInterval(id);
    };
  }, [running]);
  const now = useCallback(() => (running ? clock.current.base + performance.now() - clock.current.since : clock.current.base), [running]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && started && !solved) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [started, solved]);

  // A new puzzle remounts the shell (parents pass key={puzzleKey}), which resets all per-puzzle state.

  const api = useMemo<BoardApi<St>>(
    () => ({
      onMove(state, info) {
        stateRef.current = state;
        if (!started) setStarted(true);
        if (info?.mistake) mistakes.current++;
        setHint(null);
        onMove?.(state, now(), info);
      },
      onSolved(state) {
        stateRef.current = state;
        setSolved(true);
        const t = now();
        clock.current.base = t;
        setElapsed(t);
        void onSolved(state, t, { hints: hintsUsed.current, mistakes: mistakes.current });
      },
      onFailed(state, reason) {
        stateRef.current = state;
        setSolved(true);
        onFailed?.(state, reason, now());
      },
      feedback(text, tone = "info", icon) {
        setFeedback((f) => ({ text, tone, icon, n: f.n + 1 }));
      },
      ruleBreak(message) {
        mistakes.current++;
        setFeedback((f) => ({ text: message, tone: "danger", icon: "warning", n: f.n + 1 }));
        setLive(message);
        play("buzz");
      },
      announce(text) {
        setLive(text);
      },
      setControls,
    }),
    [started, now, onMove, onSolved, onFailed],
  );

  const askHint = useCallback(async () => {
    if (hints <= 0 || !requestHint || solved) return;
    setStarted(true);
    const h = await requestHint(stateRef.current);
    if (!h) return;
    hintsUsed.current++;
    setHints((n) => n - 1);
    setHint(h);
    setFeedback((f) => ({ text: h.text, tone: "info", icon: "lightbulb", n: f.n + 1 }));
    setLive(h.text);
    play("twinkle");
  }, [hints, requestHint, solved]);

  // Hint controls registered by the board call into the shell.
  const shownControls = controls.map((c) =>
    c.id === "hint" ? { ...c, onPress: askHint, disabled: hints <= 0 || solved || c.disabled } : c,
  );

  const style = {
    "--world": world.color,
    "--world-ink": world.ink,
    "--world-depth": `color-mix(in srgb, ${world.color} 55%, #0E0F1A)`,
  } as CSSProperties;

  return (
    <div className="bg-bg relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col" style={style} data-world={meta.world}>
      {/* 1 Top bar */}
      <header className="safe-top relative z-10 flex items-center gap-2 px-3 pb-2 lg:pt-6">
        <IconButton icon="arrow-left" label="Back" onClick={onExit} />
        <div className="flex flex-1 justify-center">
          {!relaxed && (
            <div
              className="num bg-surface flex h-11 items-center gap-2 rounded-[14px] px-4 text-[22px] font-semibold"
              role="timer"
              aria-label={`Time ${formatClock(elapsed)}`}
            >
              <Icon name="timer" size={18} className="text-muted" />
              {formatClock(elapsed)}
            </div>
          )}
        </div>
        {requestHint && (
          <IconButton icon="lightbulb" label="Hints" tone="gold" badge={hints} onClick={askHint} disabled={hints <= 0 || solved} />
        )}
        <IconButton icon="question" label="Help" onClick={onHelp} />
        <IconButton icon="pause" label="Pause" onClick={() => setPaused(true)} disabled={solved} />
      </header>

      {/* 2 Strip */}
      {strip && !relaxed && <div className="relative z-20 px-3">{strip}</div>}

      {/* 3 Title + rule */}
      <div className="flex items-baseline justify-between gap-3 px-5 pt-1.5 pb-3.5">
        <h1 className="font-display text-[24px] font-black text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
          {meta.name}
        </h1>
        <span className="num text-muted text-[14px] font-medium whitespace-nowrap">{label}</span>
      </div>
      <p className="text-muted px-[18px] text-[15px] leading-[1.4]">{meta.rule}</p>

      {/* 4 Board slot */}
      <main className="relative z-0 flex justify-center p-[18px]" aria-label={`${meta.name} board`}>
        <Board
          key={puzzleKey}
          puzzle={puzzle}
          mode={mode}
          initialState={initialState}
          hint={hint}
          disabled={locked || paused || solved}
          api={api}
        />
      </main>

      {/* 5 Feedback line: never overlays the board */}
      <div className="mx-4 min-h-12">
        <AnimatePresence mode="popLayout" initial={false}>
          {feedback.text && <FeedbackLine key={feedback.n} {...feedback} />}
        </AnimatePresence>
      </div>

      {/* 6 Controls */}
      {shownControls.length > 0 && (
        <div
          className="safe-bottom mt-auto grid gap-2.5 px-4 pt-3.5 pb-7"
          style={{ gridTemplateColumns: `repeat(${shownControls.length}, minmax(0, 1fr))` }}
        >
          {shownControls.map((c) => (
            <ToolButton key={c.id} c={c} />
          ))}
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {live}
      </div>

      <PauseOverlay
        open={paused}
        title={meta.name}
        elapsed={elapsed}
        onResume={() => setPaused(false)}
        onRestart={undefined}
        onQuit={onExit}
      />
    </div>
  );
}

export function FeedbackLine({ text, tone, icon }: Omit<FeedbackState, "n">) {
  const look =
    tone === "danger"
      ? { bg: "var(--danger-tint)", ring: "inset 0 0 0 2px var(--danger)", ic: "var(--danger)", i: icon ?? "warning" }
      : tone === "success"
        ? { bg: "var(--success-tint)", ring: "inset 0 0 0 2px var(--accent)", ic: "var(--accent)", i: icon ?? "check-circle" }
        : {
            bg: "var(--surface)",
            ring: "none",
            ic: icon === "lightbulb" ? "var(--gold)" : "var(--text-muted)",
            i: icon ?? "hand-pointing",
          };
  return (
    <motion.div
      role={tone === "danger" ? "alert" : "status"}
      initial={{ opacity: 0, transform: "translateY(-6px) scale(.98)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="flex min-h-12 items-center gap-2.5 rounded-[16px] px-3.5 py-3"
      style={{ background: look.bg, boxShadow: look.ring }}
    >
      <Icon name={look.i} size={22} style={{ color: look.ic, flex: "none" }} />
      <span className="text-[15px] font-medium">{text}</span>
    </motion.div>
  );
}

function ToolButton({ c }: { c: ControlSpec }) {
  const tone = c.active || c.tone === "world" ? "world" : c.tone === "gold" ? "gold" : "default";
  const look =
    tone === "world"
      ? { bg: "var(--world)", fg: "#0E0F1A", sh: "var(--world-depth)" }
      : { bg: "var(--surface-raised)", fg: tone === "gold" ? "var(--gold)" : "var(--text)", sh: "var(--depth)" };
  return (
    <button
      type="button"
      onClick={c.onPress}
      disabled={c.disabled}
      aria-pressed={c.active ?? undefined}
      className="toy flex h-16 flex-col items-center justify-center gap-[3px] rounded-[18px]"
      style={
        c.disabled
          ? undefined
          : { background: look.bg, color: look.fg, ["--btn-depth" as string]: look.sh, boxShadow: `0 5px 0 ${look.sh}` }
      }
    >
      <Icon name={c.icon} size={22} />
      <span className="text-[13px] font-semibold">{c.label}</span>
    </button>
  );
}
