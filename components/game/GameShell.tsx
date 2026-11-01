"use client";

import { markTip, seenTips } from "@/lib/tips";
import { tipsCopy } from "@/lib/copy/tips";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BoardApi, BoardProps, ControlSpec, FeedbackTone, Hint, PlayMode } from "@/games/types";
import type { GameMeta } from "@/lib/catalog";
import { WORLD_BY_ID } from "@/lib/catalog";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { useSettings } from "@/lib/settings/store";
import { useMe } from "@/lib/client/api";
import { BOARD_THEMES } from "@/lib/gamification/cosmetics";
import { play } from "@/lib/audio";
import { formatClock } from "@/lib/format";
import { PauseOverlay } from "./PauseOverlay";
import { HintConfirm, hintConfirmed, rememberHintConfirmed } from "./HintConfirm";
import { copy } from "@/lib/copy";

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
  /** extra props passed straight to the board (e.g. `ghost` for Ghost Race) */
  extra?: Record<string, unknown>;
  /** another overlay (How to play) is open: the clock stops, input pauses */
  pausedExternally?: boolean;
  /** replaces the tool bar after a clear (free play's compact result bar); the header stays */
  endBar?: ReactNode;
  /** solved: hold the board with a highlight (set by the parent while it waits for the server) */
  celebrate?: boolean;
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
    extra,
    pausedExternally,
    endBar,
    celebrate,
  } = props;
  const world = WORLD_BY_ID[meta.world];
  const relaxed = useSettings((s) => s.relaxed);
  // Equipped Shop board theme: colours the backdrop and frame around the board, never the cells.
  const boardTheme = useMe().data?.boardTheme ?? null;
  const theme = boardTheme ? BOARD_THEMES[boardTheme] : undefined;

  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hints, setHints] = useState(hintsLeft);
  const [hint, setHint] = useState<Hint | null>(null);
  const [controls, setControls] = useState<ControlSpec[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ text: "", tone: "info", n: 0 });
  const [live, setLive] = useState("");
  const [confirmHint, setConfirmHint] = useState(false);
  const stateRef = useRef<St | undefined>(initialState);
  const mistakes = useRef(0);
  // Boards may report one slip twice (onMove {mistake} and ruleBreak in the same tick): count it once.
  const lastMistakeAt = useRef(-Infinity);
  const countMistake = () => {
    const t = performance.now();
    if (t - lastMistakeAt.current > 50) mistakes.current++;
    lastMistakeAt.current = t;
  };
  const hintsUsed = useRef(0);
  const clock = useRef({ base: 0, since: 0 });
  // A board with its own clock (fixed-step simulation) replaces the wall clock for display and scoring.
  const boardClock = useRef<(() => number) | null>(null);

  // Timer: starts on first interaction, stops while paused or hidden (FR-GP-02).
  const running = started && !paused && !solved && !pausedExternally && !confirmHint;
  useEffect(() => {
    if (!running) return;
    const c = clock.current; // one mutable clock for the shell's lifetime
    c.since = performance.now();
    const id = setInterval(() => setElapsed(boardClock.current ? boardClock.current() : c.base + performance.now() - c.since), 200);
    return () => {
      c.base += performance.now() - c.since;
      clearInterval(id);
    };
  }, [running]);
  const now = useCallback(
    () =>
      boardClock.current
        ? boardClock.current()
        : running
          ? clock.current.base + performance.now() - clock.current.since
          : clock.current.base,
    [running],
  );

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
        if (info?.mistake) countMistake();
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
      ruleBreak(rule) {
        countMistake();
        // The first slip ever also says what a slip is (SPZ-15).
        let message = rule;
        if (!seenTips().has("slips")) {
          markTip("slips");
          message = `${rule} ${tipsCopy.slips}`;
        }
        setFeedback((f) => ({ text: message, tone: "danger", icon: "warning", n: f.n + 1 }));
        setLive(message);
        play("buzz");
      },
      announce(text) {
        setLive(text);
      },
      setControls,
      setClock(fn) {
        boardClock.current = fn;
      },
    }),
    [started, now, onMove, onSolved, onFailed],
  );

  const spendHint = useCallback(async () => {
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
  // Only the Hint button spends a hint, and the first one per game asks first (XP cost on Dailies).
  const askHint = useCallback(() => {
    if (hints <= 0 || !requestHint || solved) return;
    if (hintConfirmed(meta.id)) void spendHint();
    else setConfirmHint(true);
  }, [hints, requestHint, solved, meta.id, spendHint]);

  // Hint controls registered by the board call into the shell.
  // No hint source (Duels, Party Races): the Hint control is hidden rather than dead.
  const shownControls = controls
    .filter((c) => c.id !== "hint" || requestHint)
    .map((c) => (c.id === "hint" ? { ...c, onPress: askHint, disabled: hints <= 0 || solved || c.disabled } : c));

  const style = {
    "--world": world.color,
    "--world-ink": world.ink,
    "--world-depth": `color-mix(in srgb, ${world.color} 55%, #0E0F1A)`,
  } as CSSProperties;

  return (
    <div className="bg-bg relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col" style={style} data-world={meta.world}>
      {/* 1 Top bar */}
      <header className="safe-top relative z-10 flex items-center gap-3 px-3 pb-2 lg:pt-6">
        <IconButton icon="arrow-left" label="Back" onClick={onExit} />
        <div className="flex min-w-0 flex-1 justify-center">
          {!relaxed && (
            <div
              className="num bg-surface flex h-11 items-center gap-2 rounded-[14px] px-4 text-[22px] font-semibold max-[359px]:px-2.5 max-[359px]:text-[19px]"
              role="timer"
              aria-label={`Time ${formatClock(elapsed)}`}
            >
              <Icon name="timer" size={18} className="text-muted max-[359px]:hidden" />
              {formatClock(elapsed)}
            </div>
          )}
        </div>
        {requestHint && (
          // A counter only: hints are spent from the Hint button in the tool bar, never from here.
          <div
            role="status"
            aria-label={copy.shell.hintsLeft(hints)}
            className="text-gold bg-surface relative flex size-11 shrink-0 items-center justify-center rounded-[14px]"
          >
            <Icon name="lightbulb" size={20} />
            <span className="num bg-gold text-on-accent absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold">
              {hints}
            </span>
          </div>
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
      <main
        className={`relative z-0 flex justify-center p-[18px] ${theme ? "rounded-[26px]" : ""} ${celebrate || solved ? "shell-solved" : ""}`}
        style={theme ? { background: theme.bg, boxShadow: `inset 0 0 0 2px ${theme.mark}` } : undefined}
        data-board-theme={theme ? boardTheme! : undefined}
        aria-label={`${meta.name} board`}
      >
        <Board
          {...extra}
          extra={extra}
          key={puzzleKey}
          puzzle={puzzle}
          mode={mode}
          initialState={initialState}
          hint={hint}
          disabled={locked || paused || solved || pausedExternally}
          api={api}
        />
      </main>

      {/* 5 Feedback line: never overlays the board */}
      {/* One status at a time: the old line leaves (120 ms) before the new one enters. */}
      <div className="relative mx-4 min-h-12">
        <AnimatePresence mode="wait" initial={false}>
          {feedback.text && <FeedbackLine key={feedback.n} {...feedback} />}
        </AnimatePresence>
      </div>

      {/* 6 Controls (or the end bar after a clear) */}
      {endBar ? (
        <div className="safe-bottom mt-auto px-4 pt-3.5 pb-7">{endBar}</div>
      ) : (
        shownControls.length > 0 && (
          <div
            className="safe-bottom mt-auto grid gap-2.5 px-4 pt-3.5 pb-7"
            style={{ gridTemplateColumns: `repeat(${shownControls.length}, minmax(0, 1fr))` }}
          >
            {shownControls.map((c) => (
              <ToolButton key={c.id} c={c} />
            ))}
          </div>
        )
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
        onHelp={
          onHelp
            ? () => {
                setPaused(false);
                onHelp();
              }
            : undefined
        }
      />
      <HintConfirm
        open={confirmHint}
        daily={mode === "daily"}
        onCancel={() => setConfirmHint(false)}
        onConfirm={() => {
          rememberHintConfirmed(meta.id);
          setConfirmHint(false);
          void spendHint();
        }}
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
  // The active tool is always visible: filled accent, aria-pressed="true" (audit: tool mode was invisible).
  const tone = c.active ? "active" : c.tone === "world" ? "world" : c.tone === "gold" ? "gold" : "default";
  const look =
    tone === "active"
      ? { bg: "var(--accent)", fg: "var(--on-accent)", sh: "var(--accent-depth)" }
      : tone === "world"
        ? { bg: "var(--world)", fg: "var(--on-accent)", sh: "var(--world-depth)" }
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
