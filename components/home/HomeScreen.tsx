"use client";

import { useWarmPlay } from "@/lib/perf/prefetch";
import { useGameSettings } from "@/lib/game-settings/client";
import { homeCopy as T } from "@/lib/copy/home";
import { FirstTips } from "@/components/ui/FirstTips";

const HOME_TIPS = ["islands", "xp", "streak", "sparks"] as const;
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useMe, useToday } from "@/lib/client/api";
import { readOnboarding, writeOnboarding } from "@/lib/client/onboarding";
import { track } from "@/lib/analytics/track";
import { GAMES, GAME_BY_ID, LAUNCH_IDS, WORLD_BY_ID, gamesInWorld, isLiveGame, type WorldId } from "@/lib/catalog";
import { HomeMap, nextDaily, worldProgress } from "./HomeMap";
import { continueGame, continueHref } from "@/lib/game/next";
import { LevelRing, SparksChip, StreakChip } from "@/components/shell/Hud";
import { Spuz } from "@/components/brand/Spuz";
import { MySpuz } from "@/components/meta/MySpuz";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCountdown, msToReset } from "@/lib/format";
import { SidePanel } from "./SidePanel";
import { EventBanner } from "./EventBanner";
import { WeeklyRecapCard } from "./WeeklyRecapCard";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { BannerStack } from "@/components/notify/Banner";
import { useNotices } from "@/lib/notify/notices";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import dynamic from "next/dynamic";
import { DailyFiveCard } from "@/components/daily-five/DailyFiveCard";
import { NewGamesBanner } from "./NewGamesBanner";
import { BoardThumb } from "./BoardThumb";
import { isLadderGame } from "@/lib/game/levels";
import { useLevels } from "@/lib/client/levels";
import type { GameMeta } from "@/lib/catalog";
import { useDailyFive } from "@/lib/client/daily-five";

const BirthAskOnce = dynamic(() => import("@/components/onboarding/BirthAsk").then((m) => m.BirthAskOnce), { ssr: false });

/** The at-risk card's "resets in" countdown: the one part of Home that ticks every second. */
function ResetsIn() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the local clock starts after hydration
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <p className="num text-gold text-[13px] font-medium">{T.resetsIn(formatCountdown(msToReset(new Date(now ?? 0))))}</p>;
}

export function HomeScreen() {
  const router = useRouter();
  const me = useMe();
  const today = useToday();
  // The clock is client-only (null on the server pass): the at-risk banner and countdown use local time.
  const [now, setNow] = useState<number | null>(null);
  const { notices, dismiss } = useNotices({ me: me.data ?? null, today: today.data ?? null });
  // Daily Five (R2-05): its card sits above the map, and a sleepy streak points at it.
  const five = useDailyFive(!!me.data);
  const fiveOpen = !!five.data?.enabled && !five.data.complete && five.data.games.length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the local clock after hydration
    setNow(Date.now());
    // R3-03: Home only needs the hour (the at-risk card shows from 19:00), so it re-renders once a minute, on the
    // minute; the card's seconds countdown ticks on its own (ResetsIn), not the whole screen every second.
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(
        () => {
          setNow(Date.now());
          tick();
        },
        60_000 - (Date.now() % 60_000),
      );
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  // No profile yet: first run goes through the intro and onboarding.
  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(readOnboarding().introSeen ? "/welcome" : "/intro");
  }, [me.isSuccess, me.data, router]);

  // Onboarding funnel (admin Metrics): a profile made on /welcome has now reached Home. Once per new profile.
  useEffect(() => {
    if (!me.data || !readOnboarding().homePending) return;
    writeOnboarding({ homePending: false });
    track("onboarding_step", { kind: "home" });
  }, [me.data]);

  // Dailies off: progress is the games a player has ever cleared (free play), not today's Dailies.
  const dailiesOn = useGameSettings()["features.dailies"];
  const cleared = useMemo<Record<string, number>>(
    () => (dailiesOn ? (me.data?.today.cleared ?? {}) : Object.fromEntries((me.data?.played ?? []).map((id) => [id, 1]))),
    [me.data, dailiesOn],
  );
  const ready = (id: string) => today.data?.games.find((g) => g.id === id)?.ready ?? id === "crownfall";
  // Continue: the game played most recently (a brand-new player gets the first ready Daily).
  const recentId = continueGame(me.data?.recent, null);
  const next = recentId ?? nextDaily(cleared, ready);
  const nextMeta = next ? GAME_BY_ID[next] : null;
  // R2-01: the Continue game's page, code and board are downloaded while the player looks at Home.
  useWarmPlay(me.data && nextMeta ? continueHref(nextMeta.id, { dailiesOn, clearedToday: cleared[nextMeta.id] !== undefined }) : null);
  // R2-18: a ladder game's Continue names the level it opens ("Level 12").
  const nextLadder = !!me.data && !!nextMeta && isLadderGame(nextMeta.id);
  const levels = useLevels(nextLadder);
  const nextLevel = nextLadder && nextMeta ? levels.data?.games[nextMeta.id]?.next : undefined;
  const progress = worldProgress(cleared);
  const currentWorld: WorldId = nextMeta?.world ?? "logic";
  const featuredDone = LAUNCH_IDS.filter((id) => cleared[id] !== undefined).length;
  const hour = now === null ? 0 : new Date(now).getHours();
  const streak = me.data?.streak.current ?? 0;
  const counted = Math.max(featuredDone, me.data?.today.counted ?? 0);
  const clearedToday = Object.keys(cleared).length > 0 || counted > 0;
  const atRisk = streak > 0 && !clearedToday && hour >= 19;
  const allDone = featuredDone >= LAUNCH_IDS.length;
  const mood = allDone ? "party" : atRisk ? "sleepy" : streak >= 7 ? "fire" : "idle";

  if (!me.data) return <HomeSkeleton />;
  const d = me.data;
  const worldGames = nextMeta ? gamesInWorld(nextMeta.world) : [];
  const posInWorld = nextMeta ? worldGames.findIndex((g) => g.id === nextMeta.id) + 1 : 0;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px]">
      <main className="dotgrid relative min-h-dvh overflow-hidden">
        <header
          className="safe-top sticky top-0 z-10 flex items-center justify-between px-4 pb-3 lg:pt-6"
          style={{ background: "linear-gradient(var(--bg) 70%, transparent)" }}
        >
          <LevelRing level={d.level} pct={(d.xpInto / d.xpNeed) * 100} color={d.avatar_color} hat={d.hat} />
          <div className="flex gap-2">
            <StreakChip streak={streak} atRisk={atRisk} />
            <SparksChip sparks={d.sparks} />
          </div>
        </header>

        <div className="relative z-10 flex flex-col gap-2 px-3">
          <OfflineBanner context="home" />
          <FirstTips order={HOME_TIPS} />
          <WeeklyRecapCard />
          <EventBanner />
          {/* Streak at risk has its own designed card below; banners carry new games and league results. */}
          <BannerStack
            items={notices
              // R2-18: new games have their own card (NewGamesBanner, the admin's "new" tag) below Daily Five.
              .filter((n) => n.kind !== "streak_at_risk" && n.kind !== "new_games")
              .map((n) => ({
                id: n.id,
                icon: n.icon,
                text: n.text,
                tone: n.tone,
                actionLabel: n.actionLabel,
                onAction: n.href ? () => router.push(n.href!) : undefined,
                onDismiss: () => dismiss(n.id),
              }))}
          />
          <DailyFiveCard />
          <NewGamesBanner played={d.played ?? []} />
        </div>
        <section aria-label="The Grid" className="relative overflow-y-auto pb-[250px] lg:pb-[200px]">
          <HomeMap progress={progress} current={currentWorld} mood={mood} unit={dailiesOn ? T.islandsToday : T.islandsTried} />
        </section>

        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[250px] lg:absolute lg:h-[200px]"
          style={{ background: "linear-gradient(transparent, var(--bg) 40%)" }}
        />
        <div className="fixed inset-x-3 bottom-[92px] z-20 mx-auto flex max-w-[536px] flex-col gap-2.5 lg:absolute lg:bottom-6">
          {atRisk && (
            <motion.div
              initial={{ opacity: 0, transform: "translateY(-12px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="bg-surface flex items-center gap-1.5 rounded-[22px] py-3 pr-3.5 pl-2"
              style={{ boxShadow: "inset 0 0 0 2px var(--gold)" }}
            >
              <MySpuz mood="sleepy" size={60} still decorative />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-[16px] leading-[1.3] font-semibold text-pretty">{fiveOpen ? T.sleepyFive(streak) : T.sleepy(streak)}</p>
                <ResetsIn />
              </div>
            </motion.div>
          )}
          <PlayCard
            href={nextMeta ? continueHref(nextMeta.id, { dailiesOn, clearedToday: cleared[nextMeta.id] !== undefined }) : "/library"}
            playNav={!!nextMeta}
            game={nextMeta}
            title={
              nextMeta
                ? recentId || posInWorld > 1 || counted > 0
                  ? T.continueGame(nextMeta.name)
                  : T.playGame(nextMeta.name)
                : dailiesOn
                  ? T.allDone
                  : T.allTried
            }
            sub={
              nextMeta
                ? nextLevel
                  ? T.levelWhere(nextLevel, WORLD_BY_ID[nextMeta.world].name)
                  : T.where(WORLD_BY_ID[nextMeta.world].name, posInWorld, worldGames.length)
                : dailiesOn
                  ? T.allDoneSub
                  : T.allTriedSub
            }
            done={dailiesOn ? counted : (d.played ?? []).filter((id) => isLiveGame(id)).length}
            total={dailiesOn ? LAUNCH_IDS.length : GAMES.length}
            aria={dailiesOn ? T.todayAria : T.triedAria}
          />
          <nav aria-label="More ways to play" className="grid grid-cols-3 gap-2">
            {[
              { href: "/duel", icon: "sword", label: T.duel },
              { href: "/party", icon: "users-three", label: T.party },
              { href: "/library", icon: "squares-four", label: T.allGames },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href as never}
                className="press bg-surface-raised flex h-11 items-center justify-center gap-1.5 rounded-[14px] text-[14px] font-semibold"
              >
                <Icon name={c.icon} size={18} className="text-accent" />
                {c.label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
      <SidePanel />
      {/* R3-03: the birth ask (a sheet and its picker) is only downloaded for the players it is for. */}
      {d.birthSet === false && <BirthAskOnce me={d} />}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <main className="dotgrid relative min-h-dvh" aria-busy>
      <div className="safe-top flex items-center justify-between px-4 pb-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20 rounded-[14px]" />
          <Skeleton className="h-10 w-24 rounded-[14px]" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-6 pt-10">
        <Spuz mood="thinking" size={96} decorative />
      </div>
    </main>
  );
}

/**
 * SPZ-16: the one Play card. The ring is "Today x of N" (N = LAUNCH_IDS.length); the label names exactly what opens.
 * R2-18: a tiny static board of the game sits at the end (BoardThumb: SVG only, no board code).
 */
function PlayCard({
  href,
  playNav,
  game,
  title,
  sub,
  done,
  total,
  aria,
}: {
  href: string;
  /** The card opens a game (not All games): marks it for the tap-to-board metric. */
  playNav: boolean;
  game: GameMeta | null;
  title: string;
  sub: string;
  done: number;
  total: number;
  aria: (done: number, total: number) => string;
}) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, done / Math.max(1, total));
  return (
    <Link
      href={href as never}
      {...(playNav ? PLAY_NAV : {})}
      className="toy bg-accent text-on-accent flex h-[72px] min-w-0 items-center gap-3 rounded-[22px] pr-4 pl-3"
      style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center" aria-hidden>
        <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth="5" />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.23,1,.32,1)" }}
          />
        </svg>
        <span className="num text-[13px] leading-none font-black">
          {done}/{total}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display truncate text-[18px] leading-tight font-black">{title}</span>
        <span className="truncate text-[13px] font-semibold opacity-80">{sub}</span>
        <span className="sr-only">. {aria(done, total)}</span>
      </span>
      {game ? (
        <span className="relative shrink-0">
          <BoardThumb meta={game} />
          <span className="bg-on-accent text-accent absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full">
            <Icon name="play" size={12} />
          </span>
        </span>
      ) : (
        <Icon name="play" size={22} className="shrink-0" />
      )}
    </Link>
  );
}
