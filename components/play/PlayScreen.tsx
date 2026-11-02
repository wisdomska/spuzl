"use client";

import { primeAttempt, takePrimed } from "@/lib/client/early-attempt";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GameShell } from "@/components/game/GameShell";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";
import { BOARDS } from "@/games/board-registry";
import { WORLD_BY_ID, colourOf, type GameMeta, type WorldId } from "@/lib/catalog";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  finishAttempt,
  HttpError,
  requestHint,
  saveAttempt,
  startAttempt,
  useMe,
  useToday,
  type FinishRes,
  type StartRes,
} from "@/lib/client/api";
import { readOnboarding } from "@/lib/client/onboarding";
import { usePresence } from "@/lib/client/social";
import { dailyNumber, formatClock } from "@/lib/format";
import { nextInPath, nextLabel } from "@/lib/game/next";
import { useGameSettings } from "@/lib/game-settings/client";
import { copy } from "@/lib/copy";
import { useSettings } from "@/lib/settings/store";
import { rankFor } from "@/lib/rating/glicko2";
import { STREAK_MILESTONE_SPARKS } from "@/lib/rewards";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { SaveStreakPrompt } from "@/components/meta/SaveStreakPrompt";
import { PhotosensitivityNotice } from "./PhotosensitivityNotice";
import { finishOrQueue } from "@/lib/offline/queue";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ShareSheet } from "@/components/share/ShareSheet";
import { dailyShareText } from "@/lib/share/text";
import { cardUrl } from "@/lib/share/urls";
import { createChallengeLink, GHOST_GAMES, saveGhostRun } from "@/lib/client/challenge";
import { HowToSheet } from "./HowToSheet";
import { GuidedPlay } from "./GuidedPlay";
import { allLearned, learnedGames, needsGuided } from "@/lib/guided";
import { useLearnedSync, useMarkLearned } from "@/lib/client/learned";
import { hasLogic } from "@/games/logic-ids";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";
import { RaceLiveButton } from "@/components/multiplayer/GameChallenge";
import { useTapToBoard } from "@/lib/analytics/tap-to-board";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { gameMenuCopy } from "@/lib/copy/game-menu";
import { LevelSheet } from "@/components/levels/LevelSheet";
import { levelsCopy } from "@/lib/copy/levels";
import { dropResume, keepResume, resumeIdFor } from "@/lib/client/resume";

type Mode = "daily" | "free" | "archive" | "level";
type Phase = "loading" | "playing" | "results" | "failed" | "error";
type Difficulty = "easy" | "medium" | "hard" | "expert" | "mega";

const SAVE_EVERY_MS = 10_000;
/** Free play levels offered in the game menu (the same as Practice). */
const FREE_LEVELS = ["easy", "medium", "hard", "expert"] as const;

export function PlayScreen({
  meta,
  initialMode,
  date,
  difficulty,
  level,
}: {
  meta: GameMeta;
  initialMode: Mode;
  date?: string;
  /** Free play difficulty chosen in Practice; defaults to medium on the server */
  difficulty?: "easy" | "medium" | "hard" | "expert" | "mega";
  /** Levels mode: the level to play (default: the player's next one, chosen by the server) */
  level?: number;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  // Friends see "Playing <game>", and the admin's Last active stays current during long games.
  usePresence(!!me.data, meta.id);
  const today = useToday();
  const settings = useGameSettings();
  const relaxed = useSettings((s) => s.relaxed);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [attempt, setAttempt] = useState<StartRes | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<FinishRes | null>(null);
  const [stats, setStats] = useState({ hints: 0, mistakes: 0 });
  const [freeN, setFreeN] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [howTo, setHowTo] = useState(false);
  // Solved: hold the highlighted board (admin "play.solvedHoldMs") before results or the free-play bar.
  const [holding, setHolding] = useState(false);
  const [freeResult, setFreeResult] = useState<{ timeMs: number; xp: number; accuracy: number } | null>(null);
  const [levelResult, setLevelResult] = useState<{ timeMs: number; xp: number; ladder: NonNullable<FinishRes["ladder"]> } | null>(null);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const moves = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const lastSave = useRef(0);
  const latestState = useRef<unknown>(undefined);
  const elapsedRef = useRef(0);
  /** moves made since the last save reached the server */
  const dirty = useRef(false);
  const Board = BOARDS[meta.id];
  useTapToBoard(phase === "playing" && !!attempt && !!Board, meta.id, mode);

  // No profile yet: first run goes through onboarding.
  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(readOnboarding().introSeen ? "/welcome" : "/intro");
  }, [me.isSuccess, me.data, router]);

  // Back goes to the world page in code, so have its loading screen ready.
  useEffect(() => {
    router.prefetch(`/world/${meta.world}`);
  }, [router, meta.world]);

  const beginRef = useRef<(m: Mode, d?: Difficulty, n?: number, fresh?: boolean) => Promise<void>>(async () => {});
  /**
   * Starts (or resumes) an attempt. Free play and levels pick up the puzzle left part way on this device
   * (lib/client/resume.ts) unless `fresh` (Another puzzle, another level of difficulty).
   */
  const begin = useCallback(
    async (m: Mode, d?: Difficulty, n?: number, fresh = false): Promise<void> => {
      if (fresh) dropResume(meta.id);
      setPhase("loading");
      setResult(null);
      setHolding(false);
      setFreeResult(null);
      setLevelResult(null);
      moves.current = 0;
      try {
        // Started at the tap when possible (SPZ-01); otherwise start it now.
        const start = () =>
          startAttempt({
            game: meta.id,
            mode: m,
            date: m === "archive" ? date : undefined,
            // "Another <Game>" keeps the difficulty just played, so free play never drops abruptly after a Daily.
            difficulty: m === "free" ? (d ?? difficulty) : undefined,
            // Levels: the server checks the level is unlocked and builds it from its own seed.
            level: m === "level" ? n : undefined,
            resume:
              m === "free" || m === "level"
                ? resumeIdFor(meta.id, m, { difficulty: m === "free" ? (d ?? difficulty) : undefined, level: n })
                : undefined,
          });
        const primed = fresh ? null : takePrimed(meta.id, m, m === "free" ? (d ?? difficulty) : undefined);
        // A primed start that failed (offline blip, a mode the server refuses) falls back to a fresh start.
        const a = withLocalBackup(await (primed ? primed.catch(start) : start()));
        latestState.current = a.state ?? undefined;
        elapsedRef.current = a.activeMs ?? 0;
        dirty.current = false;
        setAttempt(a);
        setMode(m);
        setPhase("playing");
      } catch (e) {
        if (e instanceof HttpError && e.code === "daily_done" && m === "daily") {
          setNotice("Today's Daily is done. Free play is open, no limit.");
          return beginRef.current("free");
        }
        setError(e instanceof HttpError ? (e.message ?? e.code) : "Could not load the puzzle.");
        setPhase("error");
      }
    },
    [meta.id, date, difficulty],
  );
  useEffect(() => {
    beginRef.current = begin;
  }, [begin]);

  // Start (or resume) once the player is known. Runs from a timer callback so a StrictMode double effect
  // cancels the first start instead of creating two attempts.
  const playerId = me.data?.id;
  const played = me.data?.played;
  // Learned games live on the account and on this device; keep both in step.
  useLearnedSync(me.data);
  const markLearned = useMarkLearned();
  const startedToday = today.data?.games.find((g) => g.id === meta.id)?.state === "in_progress";
  // First try of a game: a short guided practice round before the real one (skippable).
  const [guided, setGuided] = useState(false);
  useEffect(() => {
    // Never waits on /today (SPZ-01): its in-progress flag is used only when already cached.
    if (!playerId) return;
    const id = setTimeout(() => {
      const first = needsGuided({
        id: meta.id,
        mode: initialMode,
        played,
        learned: allLearned(learnedGames(), me.data?.learned),
        started: startedToday,
        available: hasLogic(meta.id),
      });
      if (first) setGuided(true);
      else void beginRef.current(initialMode, undefined, level);
    }, 0);
    return () => clearTimeout(id);
  }, [playerId, meta.id, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = useCallback(
    (state: unknown, elapsedMs: number) => {
      latestState.current = state;
      elapsedRef.current = elapsedMs;
      moves.current++;
      if (!attempt) return;
      dirty.current = true;
      // Leaving any way keeps this puzzle for Resume (free play and levels; Dailies resume on the server).
      if (mode === "free" || mode === "level")
        keepResume(meta.id, { attemptId: attempt.attemptId, mode, difficulty: attempt.difficulty, level: attempt.level });
      try {
        localStorage.setItem(`spuzl.attempt.${attempt.attemptId}`, JSON.stringify({ state, elapsedMs }));
      } catch {
        /* storage full or private mode */
      }
      const now = Date.now();
      if (now - lastSave.current > SAVE_EVERY_MS) {
        lastSave.current = now;
        dirty.current = false;
        saveAttempt(attempt.attemptId, state, elapsedMs).catch(() => {});
      }
    },
    [attempt, mode, meta.id],
  );

  // Moves since the last autosave go to the server however the player leaves: Back (onExit), the back gesture or
  // a link (unmount), closing the tab or the app going to the background (pagehide). keepalive lets the request
  // finish after the page is gone.
  const flush = useCallback(() => {
    if (!attempt || !dirty.current || latestState.current === undefined) return;
    dirty.current = false;
    saveAttempt(attempt.attemptId, latestState.current, elapsedRef.current, { keepalive: true }).catch(() => {});
  }, [attempt]);
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  const onSolved = useCallback(
    async (state: unknown, elapsedMs: number, s: { hints: number; mistakes: number }) => {
      if (!attempt) return;
      // The finish carries the final state; no autosave after it.
      dirty.current = false;
      setStats(s);
      setHolding(true);
      const solvedAt = Date.now();
      const afterHold = (fn: () => void) => setTimeout(fn, Math.max(0, settings["play.solvedHoldMs"] - (Date.now() - solvedAt)));
      let res: FinishRes;
      try {
        // Offline (or the request never lands): the clear is queued on this device and synced later.
        const out = await finishOrQueue<FinishRes>(attempt.attemptId, {
          state,
          activeMs: elapsedMs,
          mistakes: s.mistakes,
          relaxed,
          localHour: new Date().getHours(),
        });
        if (out.queued) {
          setNotice("Saved on this phone. We'll sync your clear when you're back online.");
          return;
        }
        res = out.result;
      } catch {
        setNotice("Could not reach the server. Your progress is saved; try again in a moment.");
        return;
      }
      dropResume(meta.id, attempt.attemptId);
      try {
        localStorage.removeItem(`spuzl.attempt.${attempt.attemptId}`);
      } catch {}
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["today"] });
      if (!res.ok) {
        setPhase("failed");
        return;
      }
      setResult(res);
      // Rage Ridge ghost games keep the run so friends can race it (Ghost Race).
      if (res.status === "cleared" && GHOST_GAMES.includes(meta.id)) saveGhostRun(attempt.attemptId).catch(() => {});
      if (mode === "level" && res.ladder) {
        // Levels: the same compact bar as free play, led by the next level.
        void qc.invalidateQueries({ queryKey: ["levels"] });
        const ladder = res.ladder;
        afterHold(() => setLevelResult({ timeMs: res.timeMs, xp: res.reward.xp, ladder }));
        const chips = celebrationChips(res);
        if (chips.length) setNotice(chips.map((c) => c.label).join(" · "));
        return;
      }
      if (mode === "free") {
        // Free play: hold the solved board, then a compact result bar with named Next actions (never a blank screen).
        const accuracy = moves.current ? Math.round((100 * Math.max(0, moves.current - s.mistakes)) / moves.current) : 100;
        afterHold(() => setFreeResult({ timeMs: res.timeMs, xp: res.reward.xp, accuracy }));
        const chips = celebrationChips(res);
        if (chips.length) setNotice(chips.map((c) => c.label).join(" · "));
        return;
      }
      afterHold(() => setPhase("results"));
    },
    [attempt, relaxed, qc, mode, meta.id, settings],
  );

  const onFailed = useCallback(
    async (state: unknown, _reason: string, elapsedMs: number) => {
      if (!attempt) return;
      dropResume(meta.id, attempt.attemptId);
      await finishAttempt(attempt.attemptId, { state, activeMs: elapsedMs, mistakes: stats.mistakes }).catch(() => {});
      setPhase("failed");
    },
    [attempt, stats.mistakes, meta.id],
  );

  const hint = useCallback(
    async (state: unknown) => {
      if (!attempt) return null;
      try {
        return (await requestHint(attempt.attemptId, state ?? latestState.current)).hint;
      } catch {
        return null;
      }
    },
    [attempt],
  );

  // Named Next actions (audit: "Next is always named"): the Home path's next game, or another of this one.
  // Dailies off: the path simply continues after this game (every game is always open in free play).
  const dailiesOn = settings["features.dailies"];
  const clearedNow = dailiesOn
    ? { ...(me.data?.today.cleared ?? {}), ...(result?.status === "cleared" && mode === "daily" ? { [meta.id]: 1 } : {}) }
    : { [meta.id]: 1 };
  const playHref = (id: string) => (dailiesOn ? `/play/${id}` : `/play/${id}?mode=free`);
  const readyIds = new Set((today.data?.games ?? []).filter((g) => g.ready).map((g) => g.id));
  const nextId = nextInPath(meta.id, clearedNow, (id) => (today.data ? readyIds.has(id) : true));
  const nextAction = nextId
    ? {
        label: nextLabel(nextId),
        playNav: true,
        onClick: () => {
          primeAttempt(playHref(nextId));
          router.push(playHref(nextId) as never);
        },
      }
    : { label: copy.play.backToGrid, onClick: () => router.push("/") };
  const anotherAction = {
    label: copy.play.another(meta.name),
    onClick: () => {
      setFreeN((n) => (mode === "free" ? n + 1 : 1));
      void begin("free", (attempt?.difficulty as Difficulty | undefined) ?? difficulty, undefined, true);
    },
  };
  useEffect(() => {
    if (nextId && settings["perf.prefetch"]) router.prefetch(`/play/${nextId}`);
  }, [nextId, router, settings]);

  // Game menu (free play): another puzzle, or the same game at another level. The address keeps the level.
  const freeLevel = (attempt?.difficulty as Difficulty | undefined) ?? difficulty ?? "easy";
  const levelMenu =
    mode === "free"
      ? {
          value: freeLevel,
          options: [...FREE_LEVELS, ...(FREE_LEVELS.includes(freeLevel as never) ? [] : [freeLevel])].map((d) => ({
            id: d,
            label: gameMenuCopy.levels[d] ?? d,
          })),
          onChange: (d: string) => {
            if (d === freeLevel) return;
            window.history.replaceState(null, "", `/play/${meta.id}?mode=free&difficulty=${d}`);
            setFreeN(1);
            void begin("free", d as Difficulty, undefined, true);
          },
        }
      : undefined;
  const playLevel = (n?: number) => {
    setLevelsOpen(false);
    void begin("level", undefined, n);
  };
  const levelBar = levelResult ? (
    <LevelResultBar
      timeMs={levelResult.timeMs}
      xp={levelResult.xp}
      ladder={levelResult.ladder}
      relaxed={relaxed}
      onNext={() => (levelResult.ladder.next ? playLevel(levelResult.ladder.next) : void begin("free"))}
      onLevels={() => setLevelsOpen(true)}
    />
  ) : undefined;
  const levelSheet = <LevelSheet meta={meta} open={levelsOpen} onClose={() => setLevelsOpen(false)} onPlay={(n) => playLevel(n)} />;

  const label =
    mode === "level" && attempt?.level
      ? levelsCopy.level(attempt.level)
      : mode === "daily" && attempt?.date
        ? `Daily #${dailyNumber(attempt.date)}`
        : mode === "archive" && attempt?.date
          ? `Archive #${dailyNumber(attempt.date)}`
          : `Free play ${freeN}`;

  if (phase === "results" && result) {
    return (
      <>
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          kind="daily"
          title={`${meta.name} on SPUZL`}
          text={dailyShareText({
            gameId: meta.id,
            number: attempt?.date ? dailyNumber(attempt.date) : 0,
            timeMs: result.timeMs,
            hints: stats.hints,
            slips: stats.mistakes,
            score: result.score ?? null,
            streak: result.streak?.current,
          })}
          image={attempt ? cardUrl("daily", attempt.attemptId) : ""}
          fileName={`spuzl-${meta.id}.png`}
        />
        <ResultsScreen
          meta={meta}
          result={result}
          hints={stats.hints}
          mistakes={stats.mistakes}
          relaxed={relaxed}
          color={me.data?.avatar_color ?? "#B8F23A"}
          onShare={() => setShareOpen(true)}
          onChallenge={
            attempt && result.status === "cleared"
              ? async () => {
                  try {
                    const url = await createChallengeLink(attempt.attemptId);
                    const text = `Beat my ${meta.name} time on SPUZL`;
                    if (navigator.share) await navigator.share({ text, url });
                    else {
                      await navigator.clipboard.writeText(`${text} ${url}`);
                      setNotice("Challenge link copied. Send it to a friend.");
                    }
                  } catch {
                    /* share sheet dismissed */
                  }
                }
              : undefined
          }
          next={nextAction}
          another={anotherAction}
          chips={celebrationChips(result)}
        />
      </>
    );
  }

  if (guided)
    return (
      <>
        {meta.photosensitive && <PhotosensitivityNotice />}
        <GuidedPlay
          meta={meta}
          daily={initialMode === "daily"}
          onExit={() => router.push(`/world/${meta.world}`)}
          onDone={() => {
            markLearned(meta.id);
            setGuided(false);
            void beginRef.current(initialMode, undefined, level);
          }}
        />
      </>
    );

  if ((phase === "failed" || phase === "error") && mode === "level") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-6 text-center">
        <Spuz mood={phase === "failed" ? "sad" : "shocked"} size={140} decorative />
        <h1 className="font-display text-[24px] font-black">{phase === "failed" ? levelsCopy.failedTitle : levelsCopy.errorTitle}</h1>
        {phase === "error" && <p className="text-muted text-[16px]">{error ?? levelsCopy.errorBody}</p>}
        <div className="mt-4 flex w-full flex-col gap-3">
          {phase === "failed" && attempt?.level ? (
            <Button size="lg" onClick={() => playLevel(attempt.level)}>
              {levelsCopy.tryAgain}
            </Button>
          ) : null}
          <Button size="lg" variant={phase === "failed" ? "secondary" : "primary"} onClick={() => setLevelsOpen(true)}>
            {levelsCopy.allLevels}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => router.push("/")}>
            {copy.play.backToGrid}
          </Button>
        </div>
        {levelSheet}
      </main>
    );
  }

  if (phase === "failed" || phase === "error") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-6 text-center">
        <Spuz mood={phase === "failed" ? "sad" : "shocked"} size={140} decorative />
        <h1 className="font-display text-[24px] font-black">{phase === "failed" ? "Not this time" : "Something broke"}</h1>
        <p className="text-muted text-[16px]">
          {phase === "failed" ? "Shake it off. Free play never runs out." : (error ?? "Try again in a moment.")}
        </p>
        <div className="mt-4 flex w-full flex-col gap-3">
          <Button size="lg" onClick={() => void begin("free")}>
            Free play
          </Button>
          <Button size="lg" variant="secondary" onClick={() => router.push("/")}>
            Back to the Grid
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      {meta.photosensitive && <PhotosensitivityNotice />}
      {phase === "loading" || !attempt || !Board ? (
        <PlayLoading meta={meta} />
      ) : (
        <GameShell
          key={attempt.attemptId}
          meta={meta}
          Board={Board}
          puzzle={attempt.puzzle}
          mode={mode === "archive" ? "archive" : mode === "level" ? "free" : mode}
          label={label}
          initialState={attempt.state ?? undefined}
          initialElapsed={attempt.resumed ? attempt.activeMs : 0}
          hintsLeft={Math.max(0, 3 - (attempt.hints ?? 0)) + (attempt.hintsBanked ?? 0)}
          requestHint={hint}
          onMove={onMove}
          onSolved={onSolved}
          onFailed={onFailed}
          onExit={() => {
            flush();
            router.push(`/world/${meta.world}`);
          }}
          onHelp={() => setHowTo(true)}
          onNewPuzzle={mode === "free" && !holding ? anotherAction.onClick : undefined}
          difficulty={holding ? undefined : levelMenu}
          pausedExternally={howTo}
          celebrate={holding}
          puzzleKey={attempt.attemptId}
          endBar={
            levelBar ??
            (freeResult ? (
              <div className="flex flex-col gap-2">
                <SaveStreakPrompt />
                <FreeResultBar
                  timeMs={freeResult.timeMs}
                  xp={freeResult.xp}
                  accuracy={freeResult.accuracy}
                  meta={meta}
                  relaxed={relaxed}
                  next={nextAction}
                  another={anotherAction}
                />
              </div>
            ) : undefined)
          }
        />
      )}
      {mode === "level" && levelSheet}
      <OfflineBanner floating />
      {notice && <Toast text={notice} onDone={() => setNotice(null)} />}
      <HowToSheet open={howTo} meta={meta} onClose={() => setHowTo(false)} />
    </>
  );
}

/**
 * A resumed attempt with a newer copy on this device (moves made after the last autosave reached the server,
 * e.g. the app was closed offline): play on from the device's copy. The server checks the final state anyway.
 */
function withLocalBackup(a: StartRes): StartRes {
  if (!a.resumed) return a;
  try {
    const raw = localStorage.getItem(`spuzl.attempt.${a.attemptId}`);
    const local = raw ? (JSON.parse(raw) as { state: unknown; elapsedMs: number }) : null;
    if (local && local.state != null && local.elapsedMs >= (a.activeMs ?? 0))
      return { ...a, state: local.state, activeMs: local.elapsedMs };
  } catch {
    /* storage blocked or unreadable: the server's copy */
  }
  return a;
}

/**
 * Rank ups, badges, streak milestones and Full Spuzl as inline chips on the results card (audit: never
 * full-screen interstitials between puzzles).
 */
export function celebrationChips(r: FinishRes): { icon: string; label: string }[] {
  const out: { icon: string; label: string }[] = [];
  if (r.level.after > r.level.before) out.push({ icon: "arrow-fat-lines-up", label: copy.play.levelUp(r.level.after) });
  if (r.rank) {
    const a = rankFor(r.rank.before),
      b = rankFor(r.rank.after);
    if (a.name !== b.name && r.rank.after > r.rank.before)
      out.push({ icon: "medal", label: copy.play.rankUp(b.name, worldName(r.rank.track)) });
  }
  for (const u of r.unlocks) if (u.type === "badge") out.push({ icon: u.icon, label: copy.play.badge(u.name) });
  if (r.streak?.milestone)
    out.push({ icon: "fire", label: copy.play.streak(r.streak.milestone, STREAK_MILESTONE_SPARKS[r.streak.milestone] ?? 0) });
  if (r.fullSpuzl) out.push({ icon: "crown", label: copy.play.fullSpuzl });
  return out;
}

/** A rating track's world name (lib/catalog), or the track itself for duel and board tracks. */
function worldName(track: string) {
  return Object.hasOwn(WORLD_BY_ID, track) ? WORLD_BY_ID[track as WorldId].name : track;
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return (
    <div
      role="status"
      className="bg-surface-raised fixed inset-x-4 top-[max(12px,env(safe-area-inset-top))] z-[60] mx-auto max-w-[520px] rounded-[14px] px-4 py-3 text-[15px] font-medium shadow-[var(--shadow-float)]"
      style={{ animation: "fade-in 180ms var(--ease-out)" }}
    >
      {text}
    </div>
  );
}

/**
 * Loading frame in the final GameShell layout: the title and rule are real text from the first server
 * paint (they are the largest content), and only the timer, tools and board are placeholders.
 */
function PlayLoading({ meta }: { meta: GameMeta }) {
  // The game's own colour (lib/catalog colourOf), as GameShell paints it, so the frame does not change hue.
  const world = colourOf(meta);
  return (
    <div
      className="bg-bg wide:max-w-[1224px] wide:px-6 relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col"
      style={{ ["--world" as string]: world.color, ["--world-ink" as string]: world.ink }}
      data-world={meta.world}
      aria-busy
    >
      <div className="safe-top short:pb-1.5 wide:pt-5! flex items-center gap-3 px-3 pb-2">
        <Skeleton className="size-11 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-[18px] leading-6 font-black text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
            {meta.name}
          </h1>
          <Skeleton className="mt-0.5 h-3 w-16 rounded-[6px]" />
        </div>
        <Skeleton className="h-11 w-[92px] rounded-[14px] max-[359px]:w-[72px]" />
        <Skeleton className="size-11 rounded-[14px]" />
      </div>
      <p className="sr-only">{meta.rule}</p>
      {/* Wide: the board column, with the side panel's width kept free. */}
      <main className="short:py-1 wide:mr-[392px] wide:p-3 flex justify-center px-3 py-2">
        <BoardSkeleton />
      </main>
    </div>
  );
}

/** Levels mode's result bar: the level cleared, time and XP, then the next level and the level map. */
function LevelResultBar({
  timeMs,
  xp,
  ladder,
  relaxed,
  onNext,
  onLevels,
}: {
  timeMs: number;
  xp: number;
  ladder: NonNullable<FinishRes["ladder"]>;
  relaxed: boolean;
  onNext: () => void;
  onLevels: () => void;
}) {
  return (
    <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-3.5" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <span className="font-display text-accent text-[18px] font-black">{levelsCopy.levelCleared(ladder.level)}</span>
        {!relaxed && <span className="num text-[15px] font-semibold">{formatClock(timeMs)}</span>}
        {xp > 0 && <span className="num text-[15px] font-semibold">+{xp} XP</span>}
        {!relaxed && ladder.bestMs < timeMs && (
          <span className="text-muted text-[14px]">{levelsCopy.best(formatClock(ladder.bestMs))}</span>
        )}
      </div>
      {ladder.next === null && <p className="text-muted px-1 text-[14px]">{levelsCopy.ladderDone}</p>}
      <Button size="lg" icon="play" className="w-full" onClick={onNext} autoFocus>
        {ladder.next !== null ? levelsCopy.nextLevel(ladder.next) : levelsCopy.freePlay}
      </Button>
      <Button size="md" variant="secondary" className="w-full" onClick={onLevels}>
        {levelsCopy.allLevels}
      </Button>
    </div>
  );
}

/** Free play's compact result bar: time, XP and accuracy, then the two named Next actions. The header stays. */
function FreeResultBar({
  meta,
  timeMs,
  xp,
  accuracy,
  relaxed,
  next,
  another,
}: {
  meta: GameMeta;
  timeMs: number;
  xp: number;
  accuracy: number;
  relaxed: boolean;
  next: { label: string; onClick: () => void; playNav?: boolean };
  another: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-3.5" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <span className="font-display text-accent text-[18px] font-black">{copy.play.cleared}</span>
        {!relaxed && <span className="num text-[15px] font-semibold">{formatClock(timeMs)}</span>}
        {xp > 0 && <span className="num text-[15px] font-semibold">+{xp} XP</span>}
        <span className="text-muted text-[14px]">{copy.play.accuracy(accuracy)}</span>
      </div>
      <Button size="lg" icon="play" className="w-full" onClick={next.onClick} autoFocus {...(next.playNav ? PLAY_NAV : {})}>
        {next.label}
      </Button>
      <Button size="md" variant="secondary" className="w-full" onClick={another.onClick}>
        {another.label}
      </Button>
      <RaceLiveButton meta={meta} size="md" className="w-full" />
    </div>
  );
}
