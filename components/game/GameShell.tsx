"use client";

import { markTip, seenTips } from "@/lib/tips";
import { tipsCopy } from "@/lib/copy/tips";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { BoardApi, BoardProps, ControlSpec, FeedbackTone, Hint, PlayMode } from "@/games/types";
import type { GameMeta } from "@/lib/catalog";
import { UI_ACCENT } from "@/lib/catalog";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { GameMenu, type GameMenuEntry } from "./GameMenu";
import { gameMenuCopy } from "@/lib/copy/game-menu";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { useMe } from "@/lib/client/api";
import { BOARD_THEMES } from "@/lib/gamification/cosmetics";
import { play } from "@/lib/audio";
import { formatClock } from "@/lib/format";
import { PauseOverlay } from "./PauseOverlay";
import { HintConfirm, hintConfirmed, rememberHintConfirmed } from "./HintConfirm";
import { track } from "@/lib/analytics/track";
import { copy } from "@/lib/copy";
import { leaveCopy } from "@/lib/copy/leave";
import { leavePolicy, type LeaveContext } from "@/lib/game/leave";
import { useViewportWidth, useWide, wideAside, SLOT_PAD, WIDE_GAP, WIDE_GUTTER, WIDE_MAX } from "./useBoardSize";
import { ShellAsideProvider } from "./ShellAside";
import { useLeave } from "./useLeave";
import { LeaveConfirm } from "./LeaveConfirm";
import { haltClock, newClock, readClock, runClock } from "@/lib/game/shell-clock";

/**
 * Wide screens (useBoardSize `isWide`: 900 × 600 and up) split the template into two columns: the board, grown to
 * the height under the top bar, on the left; a side panel on the right with the strip, whatever the board puts
 * in `<ShellAside>`, the feedback line and the tools. Phones keep the single column below.
 *
 * The reusable board template (Game Boards file), slimmed so the board gets the room:
 * 1 slim top bar (Back, game name and label, timer, "⋯" menu), 2 optional strip, 3 board slot,
 * 4 feedback line, 5 compact tool row. The one-line rule shows under the title until the first move (R2-06), then
 * collapses into the menu; screen readers always get it with the board.
 * Everything not needed while playing (How to play, Restart, New puzzle, Difficulty, Sound, Haptics,
 * Settings, Share, Report) sits in the menu. Opening the menu pauses the clock and hides the board where
 * the mode can pause; live matches keep running and the menu says so.
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
  /** Guided first play: free, unlimited hints with no confirm, and a hint offered on its own after a pause. */
  guided?: boolean;
  /** server hint for the current state */
  requestHint?: (state: St | undefined) => Promise<Hint | null>;
  /** board reports solved; resolves when the server has decided */
  onSolved: (state: St, elapsedMs: number, stats: { hints: number; mistakes: number; boardMs: number }) => Promise<void> | void;
  onFailed?: (state: St, reason: string, elapsedMs: number) => void;
  onMove?: (state: St, elapsedMs: number, info?: { correctStreak?: number; mistake?: boolean }) => void;
  onExit: () => void;
  onHelp?: () => void;
  /** zone 2: opponent strip, race rail or ghost HUD */
  strip?: ReactNode;
  /**
   * A slim notice across the top (the guided round's practice note): one line under the top bar, over both
   * columns on a wide screen, so it never takes a side-panel slot or pushes the board down much on a phone.
   */
  banner?: ReactNode;
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
  /** menu: start this puzzle over (used when the board has no Restart or Reset tool of its own) */
  onRestart?: () => void;
  /** menu: a fresh puzzle of this game (free play) */
  onNewPuzzle?: () => void;
  /** menu: the difficulty picker (free play levels, bot levels); a change starts a new puzzle */
  difficulty?: { value: string; options: { id: string; label: string }[]; onChange: (id: string) => void };
  /**
   * Whether the menu (and Pause) may stop the clock. Default: every mode but live Duels and Races,
   * where the opponent keeps playing and the server keeps time.
   */
  canPause?: boolean;
  /**
   * How leaving works here (lib/game/leave.ts). Default from the mode: guided practice, a Duel, a Party race,
   * otherwise solo play. "managed": the parent owns leaving (its own confirm, guard and Escape), and every way
   * out of the shell (Back, the menu's Leave game, Pause's Quit) simply calls `onExit`.
   */
  leaveContext?: LeaveContext | "managed";
  /** the leave or resign call for a context that forfeits */
  onForfeit?: (opts: { keepalive: boolean }) => Promise<unknown> | void;
  /** a resumed attempt's time so far, so the clock carries on from there */
  initialElapsed?: number;
}

/** Board tools that start the puzzle over move from the tool row to the menu's Restart. */
const RESTART_TOOLS = new Set(["restart", "reset"]);
/** At most this many tools stay one tap away; any more go in the menu. */
const MAX_TOOLS = 5;

interface FeedbackState {
  text: string;
  tone: FeedbackTone;
  icon?: string;
  n: number;
}

/** Practice round only: a free hint after this long without a move (never in real games, where Hint is a tap). */
const GUIDED_IDLE_MS = 15_000;
/** Gap between the board's last placement sound and the clear arpeggio. */
const CLEAR_GAP_MS = 100;
/** Gap between the last slip's buzz and the run-over sound. */
const FAIL_GAP_MS = 320;
/** Tool controls that take something back press with the soft tap (lib/audio/press.ts). */
const SOFT_TOOLS = new Set(["undo", "erase", "clear", "delete", "reset", "restart", "deselect"]);

export function GameShell<P, St>(props: GameShellProps<P, St>) {
  const {
    meta,
    Board,
    puzzle,
    mode,
    label,
    initialState,
    hintsLeft = 3,
    guided = false,
    requestHint,
    onSolved,
    onFailed,
    onMove,
    onExit,
    onHelp,
    strip,
    banner,
    locked,
    puzzleKey,
    extra,
    pausedExternally,
    endBar,
    celebrate,
    onRestart,
    onNewPuzzle,
    difficulty,
    canPause = mode !== "duel" && mode !== "race",
    leaveContext = mode === "tutorial" ? "guided" : mode === "duel" ? "duel" : mode === "race" ? "party" : "solo",
    onForfeit,
    initialElapsed = 0,
  } = props;
  const wide = useWide();
  const vw = useViewportWidth();
  const asideW = wideAside(vw);
  const [aside, setAside] = useState<HTMLElement | null>(null);
  // The game's own colour (lib/catalog colourOf): moved games keep the hue they were designed in.
  const relaxed = useSettings((s) => s.relaxed);
  const sfx = useSettings((s) => s.sfx);
  const haptics = useSettings((s) => s.haptics);
  const setSetting = useSettings((s) => s.set);
  const osReduce = useReducedMotion();
  const appReduce = useSettings((s) => s.hydrated && prefersReducedMotion(s));
  const reduce = !!osReduce || appReduce;
  // Equipped Shop board theme: colours the backdrop and frame around the board, never the cells.
  const boardTheme = useMe().data?.boardTheme ?? null;
  const theme = boardTheme ? BOARD_THEMES[boardTheme] : undefined;

  const [elapsed, setElapsed] = useState(initialElapsed);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [solved, setSolved] = useState(false);
  const [hints, setHints] = useState(hintsLeft);
  const [hint, setHint] = useState<Hint | null>(null);
  const [controls, setControls] = useState<ControlSpec[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({ text: "", tone: "info", n: 0 });
  const [live, setLive] = useState("");
  const [confirmHint, setConfirmHint] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // A menu item opened a sheet: focus goes back to the menu button when that sheet closes.
  const returnFocus = useRef(false);
  const stateRef = useRef<St | undefined>(initialState);
  const mistakes = useRef(0);
  const lastActive = useRef(0);
  // Boards may report one slip twice (onMove {mistake} and ruleBreak in the same tick): count it once.
  const lastMistakeAt = useRef(-Infinity);
  const countMistake = () => {
    const t = performance.now();
    if (t - lastMistakeAt.current > 50) mistakes.current++;
    lastMistakeAt.current = t;
  };
  const hintsUsed = useRef(0);
  const clearPlayed = useRef(false);
  // R2-15 (lib/game/shell-clock.ts): the play clock starts on the first move; the look clock counts the board on
  // screen from load (sent with a clear as boardMs for the server's fast-solve floor, never shown).
  const clock = useRef(newClock(initialElapsed));
  const look = useRef(newClock());
  const startedRef = useRef(false);
  const [tabHidden, setTabHidden] = useState(false);
  // A board with its own clock (fixed-step simulation) replaces the wall clock for display and scoring.
  const boardClock = useRef<(() => number) | null>(null);
  // A board whose view differs from the puzzle layout (Buried after Rotate) words the hint for that view.
  const hintText = useRef<((hint: Hint) => string) | null>(null);

  // The open menu holds the game like Pause does (clock stopped, board hidden), where the mode can pause.
  const menuHold = menuOpen && canPause && !solved;

  // Leaving (lib/game/leave.ts): Back, the menu's Leave game, Pause's Quit, Escape and the back gesture.
  const managed = leaveContext === "managed";
  const policy = managed
    ? leavePolicy({ context: "solo" })
    : leavePolicy({ context: leaveContext, game: meta.id, started: started || initialState != null, over: solved });
  const leave = useLeave({ policy, exit: onExit, forfeit: onForfeit, escape: !managed });
  const requestLeave = managed ? onExit : leave.request;
  // The leave confirm holds the game like the menu does, where the mode can pause.
  const leaveHold = leave.asking && canPause;

  // Held: the clock stops and the board is hidden (Pause, the menu, How to play, the hint confirm, the leave confirm).
  const held = paused || !!pausedExternally || confirmHint || menuHold || leaveHold;
  // Timer: starts on the first move (R2-15; Start on boards with a ready screen), stops while held (FR-GP-02).
  const running = started && !solved && !held;
  useEffect(() => {
    if (!running) return;
    const c = clock.current; // one mutable clock for the shell's lifetime
    runClock(c, performance.now()); // already running if the first move started it
    const id = setInterval(() => setElapsed(boardClock.current ? boardClock.current() : readClock(c, performance.now())), 200);
    return () => {
      haltClock(c, performance.now());
      clearInterval(id);
    };
  }, [running]);
  // The look clock: the board on screen and not held, first move or not.
  const looking = !solved && !held && !locked && !tabHidden;
  useEffect(() => {
    if (!looking) return;
    const c = look.current;
    runClock(c, performance.now());
    return () => haltClock(c, performance.now());
  }, [looking]);
  const now = useCallback(() => (boardClock.current ? boardClock.current() : readClock(clock.current, performance.now())), []);
  /** The first move (or Start): the play clock runs from this instant, synchronously. */
  const begin = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runClock(clock.current, performance.now());
    setStarted(true);
  }, []);

  useEffect(() => {
    const onVis = () => {
      setTabHidden(document.hidden);
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
        begin();
        if (info?.mistake) countMistake();
        lastActive.current = performance.now();
        setHint(null);
        onMove?.(state, now(), info);
      },
      onSolved(state, opts) {
        stateRef.current = state;
        setSolved(true);
        // The clear sound lives here, once per puzzle, so no board doubles or forgets it. A short default
        // gap lets the final placement's blip land before the arpeggio; boards with a closing phrase
        // (a word's chimes, a check sting) pass a longer one.
        if (!clearPlayed.current) {
          clearPlayed.current = true;
          play("clear", { delay: (opts?.clearDelayMs ?? CLEAR_GAP_MS) / 1000 });
        }
        const at = performance.now();
        const t = now();
        haltClock(clock.current, at);
        clock.current.base = t;
        haltClock(look.current, at);
        setElapsed(t);
        // boardMs is never less than the play time (the board was up the whole time the clock ran).
        const boardMs = Math.max(t, readClock(look.current, at));
        void onSolved(state, t, { hints: hintsUsed.current, mistakes: mistakes.current, boardMs });
      },
      onFailed(state, reason) {
        stateRef.current = state;
        setSolved(true);
        // The end of a run that did not clear (out of tries, a lost bot game): a gentle falling pair,
        // after the slip's own buzz has had its moment. Once, like the clear.
        if (!clearPlayed.current) {
          clearPlayed.current = true;
          play("duelLose", { delay: FAIL_GAP_MS / 1000 });
        }
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
      start() {
        begin();
      },
      setHintText(fn) {
        hintText.current = fn;
      },
      restoreMistakes(count) {
        mistakes.current = Math.max(mistakes.current, count);
      },
    }),
    [begin, now, onMove, onSolved, onFailed],
  );

  const spendHint = useCallback(async () => {
    if (hints <= 0 || !requestHint || solved) return;
    // A hint is not a move: it never starts the clock (R2-15: the practice round's idle hints ran it before Start).
    const h = await requestHint(stateRef.current);
    if (!h) return;
    hintsUsed.current++;
    if (!guided) setHints((n) => n - 1);
    // A coaching hint has no target on the board; only the feedback line shows it.
    setHint(h.target == null ? null : h);
    const text = hintText.current?.(h) ?? h.text;
    setFeedback((f) => ({ text, tone: "info", icon: "lightbulb", n: f.n + 1 }));
    setLive(text);
    play("twinkle");
  }, [hints, requestHint, solved, guided]);
  // Only the Hint button spends a hint, and the first one per game asks first (XP cost on Dailies).
  // Metrics: every tap is a "hint_request" and every go-ahead a "hint_use", so cancelled confirms are
  // requests minus uses (kind says whether the confirm was shown).
  const askHint = useCallback(() => {
    if (hints <= 0 || !requestHint || solved) return;
    const direct = guided || hintConfirmed(meta.id);
    track("hint_request", { game: meta.id, mode, kind: direct ? "direct" : "confirm" });
    if (direct) {
      track("hint_use", { game: meta.id, mode, kind: "direct" });
      void spendHint();
    } else setConfirmHint(true);
  }, [hints, requestHint, solved, meta.id, mode, spendHint, guided]);

  // Guided first play: a hint every few seconds of stillness, so nobody stays stuck.
  useEffect(() => {
    lastActive.current = performance.now();
  }, [feedback.n]);
  // The board's own Hint control says when a hint makes sense: never while it's off (a quiz before its Start,
  // between rounds), so the idle hint can't start the clock or show a clue for a round not in play (R2-17).
  const hintOff = controls.find((c) => c.id === "hint")?.disabled === true;
  useEffect(() => {
    if (!guided || !requestHint || solved || paused || pausedExternally || menuHold || hintOff) return;
    const t = setInterval(() => {
      if (performance.now() - lastActive.current > GUIDED_IDLE_MS) {
        lastActive.current = performance.now();
        void spendHint();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [guided, requestHint, solved, paused, pausedExternally, menuHold, hintOff, spendHint]);

  // Hint controls registered by the board call into the shell.
  // No hint source (Duels, Party Races): the Hint control is hidden rather than dead.
  const shownControls = controls
    .filter((c) => c.id !== "hint" || requestHint)
    .map((c) => (c.id === "hint" ? { ...c, onPress: askHint, disabled: hints <= 0 || solved || c.disabled } : c));
  const { row, overflow, restart } = splitTools(shownControls);
  const hintBadge = guided ? "∞" : String(hints);
  const hintLeft = guided ? copy.shell.hintsFree : copy.shell.hintsLeft(hints);

  // Focus back on the menu button once a sheet opened from the menu closes.
  useEffect(() => {
    if (!returnFocus.current || paused || pausedExternally) return;
    returnFocus.current = false;
    const id = requestAnimationFrame(() => menuButton.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [paused, pausedExternally]);

  const M = gameMenuCopy;
  const openSheet = (fn: () => void) => () => {
    returnFocus.current = true;
    fn();
  };
  const share = async () => {
    const url = `${window.location.origin}/play/${meta.id}?mode=free`;
    const data = { title: M.shareTitle(meta.name), text: M.shareText(meta.name), url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(`${data.text} ${url}`);
        setFeedback((f) => ({ text: M.linkCopied, tone: "info", icon: "link", n: f.n + 1 }));
        setLive(M.linkCopied);
      }
    } catch {
      /* share sheet dismissed or clipboard refused */
    }
  };
  const report = () => {
    const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    const subject = M.reportSubject(meta.name, label);
    if (email)
      window.location.assign(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(window.location.href)}`);
    else window.open("/contact", "_blank", "noopener");
  };
  const restartEntry = restart
    ? { onSelect: restart.onPress, disabled: restart.disabled }
    : onRestart && !solved
      ? { onSelect: onRestart, disabled: false }
      : null;
  const menuSections: GameMenuEntry[][] = [
    [
      ...(onHelp ? [{ kind: "action", id: "help", label: M.howToPlay, icon: "question", onSelect: openSheet(onHelp) } as const] : []),
      ...(restartEntry ? [{ kind: "action", id: "restart", label: M.restart, icon: "arrow-clockwise", ...restartEntry } as const] : []),
      ...(onNewPuzzle ? [{ kind: "action", id: "new", label: M.newPuzzle, icon: "plus", onSelect: onNewPuzzle } as const] : []),
      ...(difficulty
        ? [{ kind: "choice", id: "difficulty", label: M.difficulty, icon: "sliders-horizontal", ...difficulty } as const]
        : []),
      ...overflow.map(
        (c) => ({ kind: "action", id: `tool-${c.id}`, label: c.label, icon: c.icon, onSelect: c.onPress, disabled: c.disabled }) as const,
      ),
    ],
    [
      {
        kind: "toggle",
        id: "sound",
        label: M.sound,
        icon: sfx ? "speaker-high" : "speaker-slash",
        checked: sfx,
        onChange: (v) => setSetting("sfx", v),
      },
      { kind: "toggle", id: "haptics", label: M.haptics, icon: "vibrate", checked: haptics, onChange: (v) => setSetting("haptics", v) },
      ...(canPause
        ? [
            {
              kind: "action",
              id: "settings",
              label: M.settings,
              icon: "gear-six",
              onSelect: openSheet(() => setPaused(true)),
              disabled: solved,
            } as const,
          ]
        : []),
    ],
    [
      { kind: "action", id: "share", label: M.share, icon: "share-network", onSelect: () => void share() },
      { kind: "action", id: "report", label: M.report, icon: "flag", onSelect: report },
    ],
    // Last, on its own: the way out, whatever the mode (a confirm follows only where leaving costs something).
    [{ kind: "action", id: "leave", label: leaveCopy.menu, icon: "sign-out", onSelect: requestLeave }],
  ];

  const style = {
    "--world": UI_ACCENT,
    "--world-ink": UI_ACCENT,
    "--world-depth": "var(--accent-depth)",
  } as CSSProperties;

  // R2-06: the one-line rule, visible under the title until the first move, then folded away (it stays in the menu
  // and in the screen-reader text). It is there from the first paint, so it never pushes the board down; the first
  // move collapses it (instantly with reduced motion). Wide screens show it in the top bar's empty middle, so the
  // board never moves at all; when the practice banner holds that spot, it heads the side panel instead.
  const showRule = !started && !solved && !!meta.rule;
  // R2-15: digits only once the clock runs (or a resumed game carries time); never in a practice round.
  const clockShown = !guided && (started || elapsed > 0);
  const ruleExit = reduce
    ? { opacity: 0, height: 0, transition: { duration: 0 } }
    : { opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const } };
  const ruleLine = (center: boolean) => (
    <p
      aria-hidden
      data-shell-rule
      className={`text-muted line-clamp-2 text-[14px] leading-5 font-medium ${center ? "text-center" : "short:text-[13px] pb-2"}`}
    >
      {meta.rule}
    </p>
  );
  const foldingRule = (cls: string, center = false) => (
    <AnimatePresence initial={false}>
      {showRule && (
        <motion.div key="rule" className={cls} exit={center ? { opacity: 0, transition: { duration: reduce ? 0 : 0.2 } } : ruleExit}>
          {ruleLine(center)}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const header = (
    // 1 Slim top bar: Back, the game (name over its label), the clock and the menu.
    <header
      className={
        wide
          ? "relative z-10 flex items-center gap-3 px-3 pt-[max(20px,env(safe-area-inset-top))] pb-2"
          : "safe-top short:pb-1.5 relative z-10 flex items-center gap-3 px-3 pb-2"
      }
    >
      <IconButton icon="arrow-left" label="Back" onClick={requestLeave} />
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-[18px] leading-6 font-black text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
          {meta.name}
        </h1>
        <p className="num text-muted truncate text-[12px] leading-4 font-medium">{label}</p>
      </div>
      {/* Wide: the banner (or else the rule) sits inline in the top bar's empty middle, so the board keeps the whole height. */}
      {wide && banner && (
        <div className="flex max-w-[640px] min-w-0 flex-[2] justify-center" data-shell-banner>
          {banner}
        </div>
      )}
      {wide && !banner && (
        <div className="flex max-w-[640px] min-w-0 flex-[2] items-center justify-center">{foldingRule("min-w-0", true)}</div>
      )}
      {/* R2-15: the one header timer. Never in a practice round; before the first move it holds its place with the
          clock icon only (never "00:00"), and the digits appear once it runs. A resumed game shows its time. */}
      {!relaxed && !guided && (
        <div
          className="num bg-surface flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-[14px] px-3 text-[20px] font-semibold max-[359px]:px-2 max-[359px]:text-[18px]"
          role="timer"
          aria-label={clockShown ? `Time ${formatClock(elapsed)}` : M.timerWaits}
          data-timer={clockShown ? "running" : "waiting"}
        >
          <Icon name="timer" size={16} className={clockShown ? "text-muted max-[359px]:hidden" : "text-muted"} />
          {clockShown && formatClock(elapsed)}
        </div>
      )}
      <GameMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        sections={menuSections}
        rule={meta.rule}
        note={solved ? undefined : canPause ? M.paused : M.livePaused}
        shield={menuHold}
        triggerRef={menuButton}
        onCloseAutoFocus={(e) => {
          // A sheet opened from the menu takes focus; it comes back to this button when the sheet closes.
          if (returnFocus.current) e.preventDefault();
        }}
      />
    </header>
  );

  // 2 Strip: above the board on a phone, at the top of the side panel on a wide screen.
  const stripZone = strip && !relaxed && <div className={wide ? "relative z-20" : "relative z-20 px-3"}>{strip}</div>;

  // 3 Board slot: 12 px each side (SLOT_PAD in useBoardSize). On a wide screen it is only as tall as the board,
  // so the height fit (shellContentBottom) measures the board, not the column.
  const slot = (
    <main
      className={`relative z-0 flex justify-center ${wide ? "w-full self-start p-3 pb-0" : "short:py-1 px-3 py-2"} ${theme ? "rounded-[26px]" : ""} ${celebrate || solved ? "shell-solved" : ""}`}
      style={theme ? { background: theme.bg, boxShadow: `inset 0 0 0 2px ${theme.mark}` } : undefined}
      data-board-theme={theme ? boardTheme! : undefined}
      data-shell-slot
      aria-label={`${meta.name} board`}
      aria-describedby={`rule-${meta.id}`}
    >
      <Board
        {...extra}
        extra={extra}
        key={puzzleKey}
        puzzle={puzzle}
        mode={mode}
        initialState={initialState}
        hint={hint}
        disabled={locked || paused || solved || pausedExternally || menuHold || leaveHold}
        api={api}
      />
    </main>
  );

  // 4 Feedback line: never overlays the board. One status at a time: the old line leaves (120 ms) before the new one enters.
  const feedbackZone = (
    <div className={wide ? "relative min-h-11" : "short:min-h-9 relative mx-3 min-h-11"} data-shell-tail>
      <AnimatePresence mode="wait" initial={false}>
        {feedback.text && <FeedbackLine key={feedback.n} {...feedback} />}
      </AnimatePresence>
    </div>
  );

  // 5 Compact tool row (or the end bar after a clear). In the side panel: at most 3 tools a row, each a slim
  // icon-and-label button (a mouse needs no 56 px target, and the panel stays short).
  const toolCols = wide ? Math.min(row.length, row.length === 4 ? 2 : 3) : row.length;
  const toolZone = endBar ? (
    <div className={wide ? "" : "safe-bottom short:pt-1.5 mt-auto px-3 pt-2.5"} data-shell-tail>
      {endBar}
    </div>
  ) : (
    row.length > 0 && (
      <div
        className={wide ? "grid gap-2 pt-1" : "safe-bottom short:pt-1.5 mt-auto grid gap-2 px-3 pt-2.5"}
        data-shell-tail
        style={{ gridTemplateColumns: `repeat(${toolCols}, minmax(0, 1fr))` }}
      >
        {row.map((c) =>
          c.id === "hint" ? (
            <ToolButton key={c.id} c={c} badge={hintBadge} extra={hintLeft} slim={wide} />
          ) : (
            <ToolButton key={c.id} c={c} slim={wide} />
          ),
        )}
      </div>
    )
  );

  const rule = (
    <p id={`rule-${meta.id}`} className="sr-only">
      {meta.rule}
    </p>
  );

  return (
    <ShellAsideProvider value={{ wide, node: aside }}>
      <div
        className={`bg-bg relative mx-auto flex min-h-dvh w-full flex-col ${wide ? "px-6" : "max-w-[560px]"}`}
        style={wide ? { ...style, maxWidth: WIDE_GUTTER * 2 + WIDE_MAX + SLOT_PAD * 2 + WIDE_GAP + asideW } : style}
        data-world={meta.world}
        data-shell
        data-wide={wide || undefined}
      >
        {header}
        {!wide && foldingRule("relative z-10 overflow-hidden px-4")}
        {banner && !wide && (
          <div className="relative z-20 px-3 pb-1" data-shell-banner>
            {banner}
          </div>
        )}
        {/* Wide: two columns (useBoardSize `boardBox`), the board filling the left and the side panel holding the
            rest. Phone: one column (the board column is `display: contents`). The board keeps its place in the
            tree either way, so turning a tablet or resizing a window never restarts the game. */}
        <div className={wide ? "flex flex-1 items-start pb-6" : "flex flex-1 flex-col"} style={wide ? { gap: WIDE_GAP } : undefined}>
          <div className={wide ? "flex min-w-0 flex-1 justify-center" : "contents"}>
            {!wide && stripZone}
            {rule}
            {slot}
            {!wide && feedbackZone}
            {!wide && toolZone}
          </div>
          {wide && (
            <aside className="flex shrink-0 flex-col gap-3 pt-3 pr-3" style={{ width: asideW }} aria-label={M.panel}>
              {banner && foldingRule("overflow-hidden")}
              {stripZone}
              <div ref={setAside} className="flex flex-col gap-3 empty:hidden" />
              {feedbackZone}
              {toolZone}
            </aside>
          )}
        </div>

        <div aria-live="polite" className="sr-only">
          {live}
        </div>

        <PauseOverlay
          open={paused}
          title={meta.name}
          elapsed={clockShown ? elapsed : null}
          onResume={() => setPaused(false)}
          onRestart={undefined}
          onQuit={() => {
            setPaused(false);
            requestLeave();
          }}
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
            track("hint_use", { game: meta.id, mode, kind: "confirm" });
            rememberHintConfirmed(meta.id);
            setConfirmHint(false);
            void spendHint();
          }}
        />
        {policy.kind !== "none" && (
          <LeaveConfirm
            kind={policy.kind}
            open={leave.asking}
            busy={leave.busy}
            onKeep={leave.keep}
            onLeave={() => void leave.confirm()}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              leave.restoreFocus(menuButton.current);
            }}
          />
        )}
      </div>
    </ShellAsideProvider>
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
      className="short:min-h-9 short:py-1.5 flex min-h-11 items-center gap-2.5 rounded-[16px] px-3.5 py-2.5"
      style={{ background: look.bg, boxShadow: look.ring }}
    >
      <Icon name={look.i} size={22} style={{ color: look.ic, flex: "none" }} />
      <span className="text-[15px] font-medium">{text}</span>
    </motion.div>
  );
}

/**
 * Tool row split: Restart / Reset go to the menu, at most MAX_TOOLS stay in the row (Hint always among them),
 * the rest go to the menu too.
 */
export function splitTools(controls: ControlSpec[]): { row: ControlSpec[]; overflow: ControlSpec[]; restart?: ControlSpec } {
  const restart = controls.find((c) => RESTART_TOOLS.has(c.id));
  const rest = controls.filter((c) => !RESTART_TOOLS.has(c.id));
  if (rest.length <= MAX_TOOLS) return { row: rest, overflow: [], restart };
  const hint = rest.find((c) => c.id === "hint");
  const others = rest.filter((c) => c !== hint);
  const keep = others.slice(0, hint ? MAX_TOOLS - 1 : MAX_TOOLS);
  return { row: hint ? [...keep, hint] : keep, overflow: others.slice(keep.length), restart };
}

/** `extra` is read after the label by screen readers only (the hint count), so the spoken name starts with the visible label. */
function ToolButton({ c, badge, extra, slim }: { c: ControlSpec; badge?: string; extra?: string; slim?: boolean }) {
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
      data-press={c.active !== undefined ? "toggle" : SOFT_TOOLS.has(c.id) ? "soft" : undefined}
      data-no-tick={c.quiet || undefined}
      className={
        slim
          ? "toy relative flex h-12 items-center justify-center gap-2 rounded-[14px] px-2"
          : "toy short:h-12 relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[16px]"
      }
      style={
        c.disabled
          ? undefined
          : { background: look.bg, color: look.fg, ["--btn-depth" as string]: look.sh, boxShadow: `0 5px 0 ${look.sh}` }
      }
    >
      <Icon name={c.icon} size={slim ? 20 : 22} />
      <span className={slim ? "truncate text-[14px] leading-5 font-semibold" : "text-[13px] leading-4 font-semibold"}>{c.label}</span>
      {extra && <span className="sr-only">, {extra}</span>}
      {badge !== undefined && (
        <span
          aria-hidden
          className="num bg-gold text-on-accent absolute -top-1.5 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
