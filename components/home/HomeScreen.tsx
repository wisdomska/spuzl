"use client";

import { homeCopy as T } from "@/lib/copy/home";
import { FirstTips } from "@/components/ui/FirstTips";

const HOME_TIPS = ["islands", "xp", "streak", "sparks"] as const;
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
          <FirstTips order={HOME_TIPS} />
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
        <section aria-label="The Grid" className="relative overflow-y-auto pb-[250px] lg:pb-[200px]">
          <HomeMap progress={progress} current={currentWorld} mood={mood} color={d.avatar_color} />
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
              <Spuz mood="sleepy" size={60} still decorative />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-[16px] leading-[1.3] font-semibold text-pretty">{T.sleepy(streak)}</p>
                <p className="num text-gold text-[13px] font-medium">{T.resetsIn(formatCountdown(msToReset(new Date(now ?? 0))))}</p>
              </div>
            </motion.div>
          )}
          <PlayCard
            href={nextMeta ? `/play/${nextMeta.id}` : "/library"}
            title={nextMeta ? (posInWorld > 1 || counted > 0 ? T.continueGame(nextMeta.name) : T.playGame(nextMeta.name)) : T.allDone}
            sub={nextMeta ? T.where(WORLD_BY_ID[nextMeta.world].name, posInWorld, worldGames.length) : T.allDoneSub}
            done={counted}
            total={LAUNCH_IDS.length}
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

/** SPZ-16: the one Play card. The ring is "Today x of 15"; the label names exactly what opens. */
function PlayCard({ href, title, sub, done, total }: { href: string; title: string; sub: string; done: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, done / Math.max(1, total));
  return (
    <Link
      href={href as never}
      className="toy bg-accent text-on-accent flex h-[72px] min-w-0 items-center gap-3 rounded-[22px] pr-4 pl-3"
      style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
      aria-label={`${title}. ${sub}. ${T.todayAria(done, total)}`}
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
      </span>
      <Icon name="play" size={22} className="shrink-0" />
    </Link>
  );
}
