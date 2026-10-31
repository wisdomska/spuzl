"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useMe, useToday } from "@/lib/client/api";
import { readOnboarding } from "@/lib/client/onboarding";
import { GAME_BY_ID, LAUNCH_IDS, WORLD_BY_ID, gamesInWorld, type WorldId } from "@/lib/catalog";
import { HomeMap, nextDaily, worldProgress } from "./HomeMap";
import { LevelRing, SparksChip, StreakChip } from "@/components/shell/Hud";
import { Spuz } from "@/components/brand/Spuz";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCountdown, msToReset } from "@/lib/format";
import { SidePanel } from "./SidePanel";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { BannerStack } from "@/components/notify/Banner";
import { useNotices } from "@/lib/notify/notices";

export function HomeScreen() {
  const router = useRouter();
  const me = useMe();
  const today = useToday();
  // The clock is client-only (null on the server pass): the at-risk banner and countdown use local time.
  const [now, setNow] = useState<number | null>(null);
  const { notices, dismiss } = useNotices({ me: me.data ?? null, today: today.data ?? null });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the local clock after hydration
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // No profile yet: first run goes through the intro and onboarding.
  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(readOnboarding().introSeen ? "/welcome" : "/intro");
  }, [me.isSuccess, me.data, router]);

  const cleared = useMemo(() => me.data?.today.cleared ?? {}, [me.data]);
  const ready = (id: string) => today.data?.games.find((g) => g.id === id)?.ready ?? id === "crownfall";
  const next = nextDaily(cleared, ready);
  const nextMeta = next ? GAME_BY_ID[next] : null;
  const progress = worldProgress(cleared);
  const currentWorld: WorldId = nextMeta?.world ?? "logic";
  const featuredDone = LAUNCH_IDS.filter((id) => cleared[id] !== undefined).length;
  const hour = now === null ? 0 : new Date(now).getHours();
  const streak = me.data?.streak.current ?? 0;
  const clearedToday = Object.keys(cleared).length > 0;
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
          <LevelRing
            level={d.level}
            pct={(d.xpInto / d.xpNeed) * 100}
            color={d.avatar_color}
            initial={d.nickname.slice(0, 1).toUpperCase()}
          />
          <div className="flex gap-2">
            <StreakChip streak={streak} atRisk={atRisk} />
            <SparksChip sparks={d.sparks} />
          </div>
        </header>

        <div className="relative z-10 flex flex-col gap-2 px-3">
          <OfflineBanner context="home" />
          {/* Streak at risk has its own designed card below; banners carry new games and league results. */}
          <BannerStack
            items={notices
              .filter((n) => n.kind !== "streak_at_risk")
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
        </div>
        <section aria-label="The Grid" className="relative overflow-y-auto pb-[320px] lg:pb-[260px]">
          <HomeMap progress={progress} current={currentWorld} mood={mood} color={d.avatar_color} />
        </section>

        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[340px] lg:absolute lg:h-[280px]"
          style={{ background: "linear-gradient(transparent, var(--bg) 22%)" }}
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
              <Spuz mood="sleepy" size={60} still decorative />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-[16px] leading-[1.3] font-semibold text-pretty">
                  Your {streak}-day streak is sleepy. One clear wakes it up.
                </p>
                <p className="num text-gold text-[13px] font-medium">Resets in {formatCountdown(msToReset(new Date(now ?? 0)))}</p>
              </div>
            </motion.div>
          )}
          <div className="flex items-center justify-between px-1">
            <p className="text-[15px] font-semibold">
              Today <span className="num text-accent">{featuredDone}</span>
              <span className="text-muted"> of {LAUNCH_IDS.length} cleared</span>
            </p>
          </div>
          <Link
            href="/library"
            className="toy bg-surface-raised flex h-[52px] items-center gap-2.5 rounded-[18px] px-4"
            style={{ boxShadow: "0 5px 0 var(--depth)" }}
          >
            <Icon name="infinity" size={22} className="text-accent" />
            <span className="font-display flex-1 text-left text-[15px] font-extrabold whitespace-nowrap">Play anytime</span>
            <span className="text-muted text-[13px] font-medium max-[359px]:hidden">51 games, no limit</span>
            <Icon name="caret-right" size={16} className="text-muted" />
          </Link>
          <div className="grid grid-cols-[1fr_64px_64px] gap-2.5 max-[359px]:grid-cols-[1fr_52px_52px] max-[359px]:gap-2">
            {nextMeta ? (
              <Link
                href={`/play/${nextMeta.id}`}
                className="toy bg-accent text-on-accent flex h-16 min-w-0 items-center justify-center gap-2.5 rounded-[20px] px-3"
                style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
              >
                <Icon name="play" size={20} className="max-[359px]:hidden" />
                <span className="flex min-w-0 flex-col items-start">
                  <span className="font-display max-w-full truncate text-[18px] font-black max-[359px]:text-[15px] max-[359px]:leading-[1.1] max-[359px]:whitespace-normal">
                    Play {nextMeta.name}
                  </span>
                  <span className="max-w-full truncate text-[13px] font-medium max-[359px]:hidden">
                    {WORLD_BY_ID[nextMeta.world].name}, {posInWorld} of {worldGames.length}
                  </span>
                </span>
              </Link>
            ) : (
              <Link
                href="/library"
                className="toy bg-accent text-on-accent flex h-16 min-w-0 items-center justify-center gap-2.5 rounded-[20px] px-3"
                style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
              >
                <Icon name="crown" size={20} />
                <span className="font-display min-w-0 text-[18px] leading-tight font-black max-[359px]:text-[15px]">
                  Full Spuzl. Free play?
                </span>
              </Link>
            )}
            <Link
              href="/duel"
              aria-label="Duel"
              className="toy bg-surface-raised flex h-16 flex-col items-center justify-center gap-0.5 rounded-[20px]"
            >
              <Icon name="sword" size={22} />
              <span className="text-[12px] font-semibold">Duel</span>
            </Link>
            <Link
              href="/party"
              aria-label="Party"
              className="toy bg-surface-raised flex h-16 flex-col items-center justify-center gap-0.5 rounded-[20px]"
            >
              <Icon name="users-three" size={22} />
              <span className="text-[12px] font-semibold">Party</span>
            </Link>
          </div>
        </div>
      </main>
      <SidePanel />
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
