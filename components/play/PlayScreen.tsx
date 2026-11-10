"use client";

import { whenQuiet } from "@/lib/perf/quiet";
import { primeAttempt, takePrimed } from "@/lib/client/early-attempt";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GameShell } from "@/components/game/GameShell";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";
import { BOARDS } from "@/games/board-registry";
import { WORLD_BY_ID, type GameMeta, type WorldId, UI_ACCENT } from "@/lib/catalog";
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
import { gameReturn } from "@/lib/onboarding-return";
import { usePresence } from "@/lib/client/social";
import { dailyNumber, formatClear, formatClock } from "@/lib/format";
import { nextInPath, nextLabelParts } from "@/lib/game/next";
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
import { useClearShare } from "@/components/share/ClearShare";
import { dailyShareText } from "@/lib/share/text";
import { GHOST_GAMES, saveGhostRun } from "@/lib/client/challenge";
import { HowToSheet } from "./HowToSheet";
import { GuidedPlay } from "./GuidedPlay";
import { allLearned, learnedGames, needsGuided } from "@/lib/guided";
import { useLearnedSync, useMarkLearned } from "@/lib/client/learned";
import { hasLogic } from "@/games/logic-ids";
import { MySpuz } from "@/components/meta/MySpuz";
import { Button } from "@/components/ui/Button";
import { RaceLiveButton } from "@/components/multiplayer/GameChallenge";
import { useTapToBoard } from "@/lib/analytics/tap-to-board";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { gameMenuCopy } from "@/lib/copy/game-menu";
import { LevelSheet } from "@/components/levels/LevelSheet";
import { levelsCopy } from "@/lib/copy/levels";
import { isLadderGame } from "@/lib/game/levels";
import { dropResume, keepResume, resumeIdFor } from "@/lib/client/resume";
import { fiveHref, useDailyFive } from "@/lib/client/daily-five";
import { dailyFiveCopy as FT } from "@/lib/copy/daily-five";
import { MAX_SCORE } from "@/lib/daily-five";
import { GAME_BY_ID } from "@/lib/catalog";
import { track } from "@/lib/analytics/track";
import { useGameCopy } from "@/lib/games-meta/client";
import { storyCopy } from "@/lib/copy/share";

/** five: a Daily Five game (R2-05), played as today's shared Daily; it ends back on the Daily Five, not free play. */
type Mode = "daily" | "free" | "archive" | "level" | "five";
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
  const [fiveResult, setFiveResult] = useState<{ status: FinishRes["status"]; timeMs: number; progress: FinishRes["dailyFive"] } | null>(
    null,
  );
  const moves = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const lastSave = useRef(0);
  const latestState = useRef<unknown>(undefined);
  const elapsedRef = useRef(0);
  /** moves made since the last save reached the server */
  const dirty = useRef(false);
  const Board = BOARDS[meta.id];
  useTapToBoard(phase === "playing" && !!attempt && !!Board, meta.id, mode);

  // No profile yet: first run goes through onboarding, then back to this game (R4-03).
  useEffect(() => {
    if (!me.isSuccess || me.data !== null) return;
    const back = `?return=${encodeURIComponent(gameReturn(meta.id))}`;
    router.replace(`${readOnboarding().introSeen ? "/welcome" : "/intro"}${back}` as never);
  }, [me.isSuccess, me.data, router, meta.id]);

  // Back goes to the world page in code, so have its loading screen ready, once this board is up and the network
  // is quiet (R2-01: never during the board's own load).
  useEffect(() => {
    let live = true;
    void whenQuiet().then(() => live && router.prefetch(`/world/${meta.world}`));
    return () => {
      live = false;
    };
  }, [router, meta.world]);

  const beginRef = useRef<(m: Mode, d?: Difficulty, n?: number, fresh?: boolean) => Promise<void>>(async () => {});
  /** The last start asked for, so the error screen's Try again repeats exactly that one. */
  const [lastStart, setLastStart] = useState<[Mode, Difficulty?, number?, boolean?] | null>(null);
  /**
   * Starts (or resumes) an attempt. Free play and levels pick up the puzzle left part way on this device
   * (lib/client/resume.ts) unless `fresh` (Another puzzle, another level of difficulty).
   */
  const begin = useCallback(
    async (m: Mode, d?: Difficulty, n?: number, fresh = false): Promise<void> => {
      if (fresh) dropResume(meta.id);
      setLastStart([m, d, n, fresh]);
      setPhase("loading");
      setResult(null);
      setHolding(false);
      setFreeResult(null);
      setLevelResult(null);
      setFiveResult(null);
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
        const primed = fresh ? null : takePrimed(meta.id, m, m === "free" ? (d ?? difficulty) : m === "level" ? n : undefined);
        // A primed start that failed (offline blip, a mode the server refuses) falls back to a fresh start.
        const a = withLocalBackup(await (primed ? primed.catch(start) : start()));
        // The first game of today's Daily Five (the server counted it): the admin Metrics "starts".
        if (m === "five" && a.first) track("daily5_start", { game: meta.id });
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
        // Daily Five: already played today, or not in today's five (an old link): back to today's five.
        if (e instanceof HttpError && m === "five" && (e.code === "daily_done" || e.code === "not_in_daily_five")) {
          void qc.invalidateQueries({ queryKey: ["daily-five"] });
          router.replace("/daily");
          return;
        }
        if (e instanceof HttpError && m === "five" && e.code === "daily_five_off") return beginRef.current("free");
        setError(e instanceof HttpError ? (e.message ?? e.code) : "Could not load the puzzle.");
        setPhase("error");
      }
    },
    [meta.id, date, difficulty, qc, router],
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
  // Daily Five: the five (cached from Home or /daily, else fetched) names the slot, e.g. "Daily Five · 2 of 5".
  const fiveCached = useDailyFive(initialMode === "five").data;
  const fiveSlot = fiveCached?.games.find((g) => g.game === meta.id);
  const startedToday =
    initialMode === "five" ? fiveSlot?.state === "in_progress" : today.data?.games.find((g) => g.id === meta.id)?.state === "in_progress";
  // First try of a game: a short guided practice round before the real one (skippable).
  const [guided, setGuided] = useState(false);
  useEffect(() => {
    // Never waits on /today (SPZ-01): its in-progress flag is used only when already cached.
    if (!playerId) return;
    const id = setTimeout(() => {
      const first = needsGuided({
        id: meta.id,
        // Every entry (R2-07): Daily, Daily Five, free play, archive and levels (Continue opens ladder games there).
        mode: initialMode,
        played,
        learned: allLearned(learnedGames(), me.data?.learned),
        started: startedToday,
        available: hasLogic(meta.id),
        disabled: settings["practice.disabled"],
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
    async (state: unknown, elapsedMs: number, s: { hints: number; mistakes: number; boardMs?: number }) => {
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
          boardMs: s.boardMs,
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
      if (mode === "five") void qc.invalidateQueries({ queryKey: ["daily-five"] });
      // The fifth game of the day just finished (the server counted it): the admin Metrics "completions".
      if (mode === "five" && res.dailyFive?.complete && res.dailyFive.done === res.dailyFive.total)
        track("daily5_complete", { game: meta.id });
      if (!res.ok) {
        setFiveResult(mode === "five" ? { status: res.status, timeMs: res.timeMs, progress: res.dailyFive } : null);
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
      if (mode === "five") {
        // Daily Five: hold the solved board, then a compact bar that leads on to the next game of the five (or
        // back to the Daily Five for the share grid), never the free-play loop.
        afterHold(() => setFiveResult({ status: res.status, timeMs: res.timeMs, progress: res.dailyFive }));
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
      const res = await finishAttempt(attempt.attemptId, { state, activeMs: elapsedMs, mistakes: stats.mistakes }).catch(() => null);
      if (mode === "five") {
        void qc.invalidateQueries({ queryKey: ["daily-five"] });
        if (res?.dailyFive?.complete && res.dailyFive.done === res.dailyFive.total) track("daily5_complete", { game: meta.id });
        setFiveResult({ status: "failed", timeMs: elapsedMs, progress: res?.dailyFive });
      }
      setPhase("failed");
    },
    [attempt, stats.mistakes, meta.id, mode, qc],
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
        label: nextLabelParts(nextId).title,
        sub: nextLabelParts(nextId).sub,
        aria: nextLabelParts(nextId).full,
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
  // First choice after a clear: keep playing this game. Games with levels go on to the player's next level (the
  // server picks it); the others deal another puzzle. The next game in the category comes second.
  const sameGameAction =
    isLadderGame(meta.id) && mode !== "level"
      ? {
          label: copy.play.nextLevel(meta.name),
          onClick: () => {
            window.history.replaceState(null, "", `/play/${meta.id}?mode=level`);
            void begin("level");
          },
        }
      : anotherAction;
  useEffect(() => {
    if (!nextId || !settings["perf.prefetch"]) return;
    let live = true;
    void whenQuiet().then(() => live && router.prefetch(`/play/${nextId}`));
    return () => {
      live = false;
    };
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

  // Daily Five: on to the next game of the five, or back to the Daily Five (share grid) when all are played.
  const fiveNext = fiveResult?.progress?.next ?? null;
  const fiveNextAction = fiveNext
    ? {
        label: FT.nextGame(GAME_BY_ID[fiveNext.game]?.name ?? fiveNext.game, fiveNext.slot, fiveResult?.progress?.total ?? 5),
        playNav: true,
        onClick: () => {
          primeAttempt(fiveHref(fiveNext.game));
          router.push(fiveHref(fiveNext.game) as never);
        },
      }
    : { label: FT.seeFive, onClick: () => router.push("/daily") };
  const fiveBar =
    mode === "five" && fiveResult ? (
      <FiveResultBar
        status={fiveResult.status}
        timeMs={fiveResult.timeMs}
        progress={fiveResult.progress}
        relaxed={relaxed}
        next={fiveNextAction}
        onFive={() => router.push("/daily")}
      />
    ) : undefined;

  // Share a clear (R2-P5): the 9:16 story card with a "Beat me" link, or a Daily's own card; and "Beat my time".
  const clearShare = useClearShare({
    meta,
    attemptId: attempt?.attemptId ?? null,
    cleared: result?.status === "cleared",
    daily: mode === "daily" || mode === "archive",
    dailyText: result
      ? dailyShareText({
          gameId: meta.id,
          number: attempt?.date ? dailyNumber(attempt.date) : 0,
          timeMs: result.timeMs,
          hints: stats.hints,
          slips: stats.mistakes,
          score: result.score ?? null,
          streak: result.streak?.current,
        })
      : "",
    onNotice: setNotice,
  });

  const label =
    mode === "level" && attempt?.level
      ? levelsCopy.level(attempt.level)
      : mode === "five" && fiveSlot
        ? FT.label(fiveSlot.slot, fiveCached?.total ?? 5)
        : (mode === "daily" || mode === "five") && attempt?.date
          ? `Daily #${dailyNumber(attempt.date)}`
          : mode === "archive" && attempt?.date
            ? `Archive #${dailyNumber(attempt.date)}`
            : `Free play ${freeN}`;

  if (phase === "results" && result) {
    return (
      <>
        {clearShare.sheet}
        <ResultsScreen
          meta={meta}
          result={result}
          hints={stats.hints}
          mistakes={stats.mistakes}
          relaxed={relaxed}
          onShare={() => void clearShare.open()}
          onChallenge={clearShare.beat}
          next={sameGameAction}
          another={nextAction}
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
          daily={initialMode === "daily" || initialMode === "five"}
          onExit={() => router.push(initialMode === "five" ? "/daily" : `/world/${meta.world}`)}
          onDone={(how) => {
            if (how !== "unavailable") markLearned(meta.id);
            setGuided(false);
            void beginRef.current(initialMode, undefined, level);
          }}
        />
      </>
    );

  if ((phase === "failed" || phase === "error") && mode === "level") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-6 text-center">
        <MySpuz mood={phase === "failed" ? "sad" : "shocked"} size={140} decorative />
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

  if ((phase === "failed" || phase === "error") && mode === "five") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-6 text-center">
        <MySpuz mood={phase === "failed" ? "sad" : "shocked"} size={140} decorative />
        <h1 className="font-display text-[24px] font-black">{phase === "failed" ? FT.missed : FT.broke}</h1>
        {phase === "error" && <p className="text-muted text-[16px]">{error ?? FT.tryLater}</p>}
        {fiveResult?.progress && <p className="text-muted num text-[16px]">{FT.score(fiveResult.progress.score, MAX_SCORE)}</p>}
        <div className="mt-4 flex w-full flex-col gap-3">
          {phase === "failed" && fiveNext ? (
            <Button size="lg" icon="play" onClick={fiveNextAction.onClick} {...PLAY_NAV}>
              {fiveNextAction.label}
            </Button>
          ) : null}
          <Button size="lg" variant={phase === "failed" && fiveNext ? "secondary" : "primary"} onClick={() => router.push("/daily")}>
            {fiveNext || phase === "error" ? FT.backToFive : FT.seeFive}
          </Button>
        </div>
      </main>
    );
  }

  if (phase === "failed" || phase === "error") {
    const P = copy.play;
    // Offline or a server blip: the same puzzle again is the obvious next step, not a switch to Free play.
    const offline = phase === "error" && typeof navigator !== "undefined" && navigator.onLine === false;
    const retry = phase === "error" ? lastStart : null;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-6 text-center">
        <MySpuz mood={phase === "failed" ? "sad" : "shocked"} size={140} decorative />
        <h1 className="font-display text-[24px] font-black">
          {phase === "failed" ? P.failedTitle : offline ? P.offlineTitle : P.brokeTitle}
        </h1>
        <p className="text-muted text-[16px]">{phase === "failed" ? P.failedBody : offline ? P.offlineBody : (error ?? P.brokeBody)}</p>
        <div className="mt-4 flex w-full flex-col gap-3">
          {retry && (
            <Button size="lg" icon="arrow-clockwise" onClick={() => void begin(...retry)}>
              {P.tryAgain}
            </Button>
          )}
          <Button size="lg" variant={retry ? "secondary" : "primary"} onClick={() => void begin("free")}>
            {P.freePlay}
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
          mode={mode === "archive" ? "archive" : mode === "level" ? "free" : mode === "five" ? "daily" : mode}
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
            router.push(mode === "five" ? "/daily" : `/world/${meta.world}`);
          }}
          onHelp={() => setHowTo(true)}
          onNewPuzzle={mode === "free" && !holding ? anotherAction.onClick : undefined}
          difficulty={holding ? undefined : levelMenu}
          pausedExternally={howTo}
          celebrate={holding}
          puzzleKey={attempt.attemptId}
          endBar={
            fiveBar ??
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
                  next={sameGameAction}
                  another={nextAction}
                  onBeatMyTime={clearShare.beat}
                  onShare={clearShare.canShare ? () => void clearShare.open() : undefined}
                  shareBusy={clearShare.busy}
                />
              </div>
            ) : undefined)
          }
        />
      )}
      {mode === "level" && levelSheet}
      {freeResult && clearShare.sheet}
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
  const { rule } = useGameCopy(meta);
  // The game's own colour (lib/catalog colourOf), as GameShell paints it, so the frame does not change hue.
  return (
    <div
      className="bg-bg wide:max-w-[1384px] min-[1280px]:wide:max-w-[1424px] wide:px-6 relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col"
      style={{ ["--world" as string]: UI_ACCENT, ["--world-ink" as string]: UI_ACCENT }}
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
        {/* R2-06: the rule sits where the shell will show it, so the board does not move when the shell arrives. */}
        <p
          aria-hidden
          className="text-muted wide:line-clamp-2 hidden max-w-[640px] min-w-0 flex-[2] text-center text-[14px] leading-5 font-medium"
        >
          {rule}
        </p>
        <Skeleton className="size-11 rounded-[14px]" />
        <Skeleton className="size-11 rounded-[14px]" />
      </div>
      <p aria-hidden className="text-muted short:text-[13px] wide:hidden line-clamp-2 px-4 pb-2 text-[14px] leading-5 font-medium">
        {rule}
      </p>
      <p className="sr-only">{rule}</p>
      {/* Wide: the board column, with the side panel's width kept free. */}
      <main className="short:py-1 wide:mr-[392px] wide:p-3 flex justify-center px-3 py-2">
        <BoardSkeleton />
      </main>
    </div>
  );
}

/** Levels mode's result bar: the level cleared, time and XP, then the next level and the level map. */
/**
 * R3-15: the player's own Spuz (in their Shop look) cheering on the compact result bars. 36 px, pulled into the
 * header line's height with negative margins so the bar is no taller than before.
 */
function ClearSpuz() {
  return <MySpuz mood="cheer" size={36} decorative className="-my-1.5" />;
}

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
        <ClearSpuz />
        <span className="font-display text-accent text-[18px] font-black">{levelsCopy.levelCleared(ladder.level)}</span>
        {!relaxed && <span className="num text-[15px] font-semibold">{formatClear(timeMs)}</span>}
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
  onBeatMyTime,
  onShare,
  shareBusy = false,
}: {
  meta: GameMeta;
  timeMs: number;
  xp: number;
  accuracy: number;
  relaxed: boolean;
  next: { label: string; sub?: string; aria?: string; onClick: () => void; playNav?: boolean };
  another: { label: string; sub?: string; aria?: string; onClick: () => void; playNav?: boolean };
  /** "Beat my time" in the Challenge sheet (admin "features.challenges") */
  onBeatMyTime?: () => void;
  /** the story card share (admin "features.storyCards") */
  onShare?: () => void;
  shareBusy?: boolean;
}) {
  return (
    <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-3.5" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <ClearSpuz />
        <span className="font-display text-accent text-[18px] font-black">{copy.play.cleared}</span>
        {!relaxed && <span className="num text-[15px] font-semibold">{formatClear(timeMs)}</span>}
        {xp > 0 && <span className="num text-[15px] font-semibold">+{xp} XP</span>}
        <span className="text-muted text-[14px]">{copy.play.accuracy(accuracy)}</span>
      </div>
      <Button
        size="lg"
        icon="play"
        className="w-full"
        onClick={next.onClick}
        autoFocus
        sub={next.sub}
        aria-label={next.aria}
        {...(next.playNav ? PLAY_NAV : {})}
      >
        {next.label}
      </Button>
      <Button
        size="md"
        variant="secondary"
        className="w-full"
        onClick={another.onClick}
        sub={another.sub}
        aria-label={another.aria}
        {...(another.playNav ? PLAY_NAV : {})}
      >
        {another.label}
      </Button>
      <div className="flex gap-2">
        <RaceLiveButton meta={meta} size="md" className="min-w-0 flex-1" onBeatMyTime={onBeatMyTime} />
        {onShare && (
          <Button size="md" variant="secondary" icon="share-fat" className="min-w-0 flex-1" onClick={onShare} disabled={shareBusy}>
            {storyCopy.shareCta}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Daily Five's result bar (R2-05): cleared (or in review), time, the five's combined score, then the next game. */
function FiveResultBar({
  status,
  timeMs,
  progress,
  relaxed,
  next,
  onFive,
}: {
  status: FinishRes["status"];
  timeMs: number;
  progress: FinishRes["dailyFive"];
  relaxed: boolean;
  next: { label: string; sub?: string; aria?: string; onClick: () => void; playNav?: boolean };
  onFive: () => void;
}) {
  return (
    <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-3.5" role="status" aria-live="polite" data-testid="five-result">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <ClearSpuz />
        <span className="font-display text-accent text-[18px] font-black">{FT.cleared}</span>
        {!relaxed && <span className="num text-[15px] font-semibold">{formatClear(timeMs)}</span>}
        {progress && <span className="num text-[15px] font-semibold">{FT.ring(progress.done, progress.total)}</span>}
        {progress && <span className="num text-accent text-[15px] font-bold">{FT.points(progress.score)}</span>}
      </div>
      {status === "flagged" && <p className="text-muted px-1 text-[14px]">{FT.inReview}</p>}
      <Button
        size="lg"
        icon={next.playNav ? "play" : "share-network"}
        className="w-full"
        onClick={next.onClick}
        autoFocus
        {...(next.playNav ? PLAY_NAV : {})}
      >
        {next.label}
      </Button>
      {next.playNav && (
        <Button size="md" variant="secondary" className="w-full" onClick={onFive}>
          {FT.backToFive}
        </Button>
      )}
    </div>
  );
}
