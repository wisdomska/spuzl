"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GameShell } from "@/components/game/GameShell";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";
import { BOARDS } from "@/games/board-registry";
import { setGuessAttempt } from "@/games/_shared/guess";
import { WORLD_BY_ID, type GameMeta } from "@/lib/catalog";
import { Skeleton } from "@/components/ui/Skeleton";
import { finishAttempt, HttpError, requestHint, saveAttempt, startAttempt, useMe, type FinishRes, type StartRes } from "@/lib/client/api";
import { readOnboarding } from "@/lib/client/onboarding";
import { dailyNumber } from "@/lib/format";
import { useSettings } from "@/lib/settings/store";
import { rankFor } from "@/lib/rating/glicko2";
import { STREAK_MILESTONE_SPARKS } from "@/lib/rewards";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { CelebrationChain, type Celebration } from "@/components/celebrate/Celebrations";
import { PhotosensitivityNotice } from "./PhotosensitivityNotice";
import { finishOrQueue } from "@/lib/offline/queue";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ShareSheet } from "@/components/share/ShareSheet";
import { dailyShareText } from "@/lib/share/text";
import { cardUrl } from "@/lib/share/urls";
import { createChallengeLink, GHOST_GAMES, saveGhostRun } from "@/lib/client/challenge";
import { HowToSheet } from "./HowToSheet";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";

type Mode = "daily" | "free" | "archive";
type Phase = "loading" | "playing" | "results" | "celebrate" | "failed" | "error";

const SAVE_EVERY_MS = 10_000;

export function PlayScreen({
  meta,
  initialMode,
  date,
  difficulty,
}: {
  meta: GameMeta;
  initialMode: Mode;
  date?: string;
  /** Free play difficulty chosen in Practice; defaults to medium on the server */
  difficulty?: "easy" | "medium" | "hard" | "expert" | "mega";
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const relaxed = useSettings((s) => s.relaxed);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [attempt, setAttempt] = useState<StartRes | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<FinishRes | null>(null);
  const [stats, setStats] = useState({ hints: 0, mistakes: 0 });
  const [freeN, setFreeN] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [howTo, setHowTo] = useState(false);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const lastSave = useRef(0);
  const latestState = useRef<unknown>(undefined);
  const elapsedRef = useRef(0);
  const Board = BOARDS[meta.id];

  // No profile yet: first run goes through onboarding.
  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(readOnboarding().introSeen ? "/welcome" : "/intro");
  }, [me.isSuccess, me.data, router]);

  // Back goes to the world page in code, so have its loading screen ready.
  useEffect(() => {
    router.prefetch(`/world/${meta.world}`);
  }, [router, meta.world]);

  const beginRef = useRef<(m: Mode) => Promise<void>>(async () => {});
  const begin = useCallback(
    async (m: Mode): Promise<void> => {
      setPhase("loading");
      setResult(null);
      try {
        const a = await startAttempt({
          game: meta.id,
          mode: m,
          date: m === "archive" ? date : undefined,
          difficulty: m === "free" ? difficulty : undefined,
        });
        latestState.current = a.state ?? undefined;
        setGuessAttempt(a.attemptId);
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
  // Content-game guesses resolve against this screen's attempt; forget it when the screen goes.
  useEffect(() => () => setGuessAttempt(null), []);

  // Start (or resume) once the player is known. Runs from a timer callback so a StrictMode double effect
  // cancels the first start instead of creating two attempts.
  const playerId = me.data?.id;
  useEffect(() => {
    if (!playerId) return;
    const id = setTimeout(() => void beginRef.current(initialMode), 0);
    return () => clearTimeout(id);
  }, [playerId, meta.id, initialMode]);

  const onMove = useCallback(
    (state: unknown, elapsedMs: number) => {
      latestState.current = state;
      elapsedRef.current = elapsedMs;
      if (!attempt) return;
      try {
        localStorage.setItem(`spuzl.attempt.${attempt.attemptId}`, JSON.stringify({ state, elapsedMs }));
      } catch {
        /* storage full or private mode */
      }
      const now = Date.now();
      if (now - lastSave.current > SAVE_EVERY_MS) {
        lastSave.current = now;
        saveAttempt(attempt.attemptId, state, elapsedMs).catch(() => {});
      }
    },
    [attempt],
  );

  const onSolved = useCallback(
    async (state: unknown, elapsedMs: number, s: { hints: number; mistakes: number }) => {
      if (!attempt) return;
      setStats(s);
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
      if (mode === "free") {
        // Free play: a quick toast and straight into the next puzzle (prototype onClear()).
        setNotice(res.reward.xp > 0 ? `Clean. +${res.reward.xp} XP. Puzzle ${freeN + 1} loading.` : `Clean. Puzzle ${freeN + 1} loading.`);
        setCelebrations(buildCelebrations(res));
        setTimeout(() => {
          setFreeN((n) => n + 1);
          void beginRef.current("free");
        }, 1500);
        return;
      }
      setTimeout(() => setPhase("results"), 1100);
    },
    [attempt, relaxed, qc, mode, freeN, meta.id],
  );

  const onFailed = useCallback(
    async (state: unknown, _reason: string, elapsedMs: number) => {
      if (!attempt) return;
      await finishAttempt(attempt.attemptId, { state, activeMs: elapsedMs, mistakes: stats.mistakes }).catch(() => {});
      setPhase("failed");
    },
    [attempt, stats.mistakes],
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

  const label =
    mode === "daily" && attempt?.date
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
          onNext={() => {
            const chain = buildCelebrations(result);
            if (chain.length) {
              setCelebrations(chain);
              setPhase("celebrate");
            } else void begin("free");
          }}
        />
      </>
    );
  }

  if (phase === "celebrate") {
    return <CelebrationChain items={celebrations} onDone={() => void begin("free")} />;
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
          mode={mode === "archive" ? "archive" : mode}
          label={label}
          initialState={attempt.state ?? undefined}
          hintsLeft={Math.max(0, 3 - (attempt.hints ?? 0)) + (attempt.hintsBanked ?? 0)}
          requestHint={hint}
          onMove={onMove}
          onSolved={onSolved}
          onFailed={onFailed}
          onExit={() => {
            if (attempt && latestState.current !== undefined)
              saveAttempt(attempt.attemptId, latestState.current, elapsedRef.current).catch(() => {});
            router.push(`/world/${meta.world}`);
          }}
          onHelp={() => setHowTo(true)}
          puzzleKey={attempt.attemptId}
        />
      )}
      <OfflineBanner floating />
      {notice && <Toast text={notice} onDone={() => setNotice(null)} />}
      <HowToSheet open={howTo} meta={meta} onClose={() => setHowTo(false)} />
    </>
  );
}

/** Builds the celebration chain from a server result (prototype order: level, rank, badge, streak, Full Spuzl). */
export function buildCelebrations(r: FinishRes): Celebration[] {
  const out: Celebration[] = [];
  if (r.level.after > r.level.before)
    out.push({
      kind: "level",
      level: r.level.after,
      sparks: 20 * (r.level.after - r.level.before),
      unlock: r.level.after % 5 === 0 ? "New cosmetic" : undefined,
    });
  if (r.rank) {
    const a = rankFor(r.rank.before),
      b = rankFor(r.rank.after);
    if (a.name !== b.name && r.rank.after > r.rank.before)
      out.push({ kind: "rank", world: worldName(r.rank.track), rank: b.name, from: a.name });
  }
  for (const u of r.unlocks)
    if (u.type === "badge") out.push({ kind: "badge", name: u.name, tier: u.tier, icon: u.icon, description: "", sparks: u.sparks });
  if (r.streak?.milestone)
    out.push({
      kind: "streak",
      days: r.streak.milestone,
      sparks: STREAK_MILESTONE_SPARKS[r.streak.milestone] ?? 0,
      freeze: r.streak.freezeEarned,
    });
  if (r.fullSpuzl) out.push({ kind: "full", xp: 150, totalMs: r.timeMs });
  return out;
}

function worldName(track: string) {
  const names: Record<string, string> = {
    logic: "Logic Lab",
    line: "Line Lane",
    shape: "Shape Shed",
    number: "Number Den",
    word: "Word Woods",
    clue: "Clue Cave",
    reflex: "Reflex Rink",
    rage: "Rage Ridge",
    board: "Board Bay",
  };
  return names[track] ?? track;
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
  const world = WORLD_BY_ID[meta.world];
  return (
    <div
      className="bg-bg relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col"
      style={{ ["--world" as string]: world.color, ["--world-ink" as string]: world.ink }}
      data-world={meta.world}
      aria-busy
    >
      <div className="safe-top flex items-center gap-2 px-3 pb-2 lg:pt-6">
        <Skeleton className="size-11 rounded-[14px]" />
        <div className="flex min-w-0 flex-1 justify-center">
          <Skeleton className="h-11 w-[116px] rounded-[14px] max-[359px]:w-[80px]" />
        </div>
        <Skeleton className="size-11 rounded-[14px]" />
        <Skeleton className="size-11 rounded-[14px]" />
      </div>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-1.5 pb-3.5">
        <h1 className="font-display text-[24px] font-black text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
          {meta.name}
        </h1>
      </div>
      <p className="text-muted px-[18px] text-[15px] leading-[1.4]">{meta.rule}</p>
      <main className="flex justify-center p-[18px]">
        <BoardSkeleton />
      </main>
    </div>
  );
}
