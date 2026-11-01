"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMe, useToday } from "@/lib/client/api";
import { useAcceptInvite, useFriends } from "@/lib/client/social";
import { takePendingInvite } from "@/lib/client/invite";
import { GAME_BY_ID, LAUNCH_IDS } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { AvatarChip } from "@/components/meta/ui";
import { formatNumber } from "@/lib/format";
import { nextDaily } from "./HomeMap";

/**
 * Desktop right panel, 360 px (States, Share, Light and Desktop file, "Desktop home"):
 * you, streak and wallet, today's board of featured Dailies, Play next, Duel and Party, friends online.
 */
export function SidePanel() {
  const me = useMe();
  const today = useToday();
  // The side panel only shows on wide screens; phones skip the friends request entirely (SPZ-01).
  const wide = useWide();
  const friends = useFriends(!!me.data && wide);
  // Mounted on Home and every tabbed screen (hidden below 1024 px): an invite opened before onboarding
  // is accepted as soon as the new player has a profile.
  const accept = useAcceptInvite();
  const hasMe = !!me.data;
  useEffect(() => {
    if (!hasMe) return;
    const code = takePendingInvite();
    if (code) accept.mutate(code);
  }, [hasMe]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = me.data;
  const cleared = d?.today.cleared ?? {};
  const ready = (id: string) => today.data?.games.find((g) => g.id === id)?.ready ?? id === "crownfall";
  const next = nextDaily(cleared, ready);
  const nextMeta = next ? GAME_BY_ID[next] : null;
  const done = Math.max(LAUNCH_IDS.filter((id) => cleared[id] !== undefined).length, d?.today.counted ?? 0);
  const online = (friends.data?.friends ?? []).filter((f) => f.presence.online).slice(0, 6);
  const pct = d ? Math.round((d.xpInto / Math.max(1, d.xpNeed)) * 100) : 0;

  return (
    <aside
      aria-label="Today"
      className="border-line bg-surface sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-l p-6 lg:flex"
    >
      {!d ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-14 rounded-[16px]" />
          <Skeleton className="h-[52px] rounded-[14px]" />
          <Skeleton className="h-16 rounded-[20px]" />
        </div>
      ) : (
        <>
          <Link href="/me" className="flex items-center gap-3 rounded-[16px]">
            <span
              className="relative flex size-14 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--accent) 0 ${pct}%, var(--line) ${pct}% 100%)` }}
              aria-hidden
            >
              <AvatarChip nickname={d.nickname} color={d.avatar_color} size={46} radius={14} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display truncate text-[17px] font-extrabold">{d.nickname}</span>
              <span className="text-muted text-[14px] font-medium">
                Level {d.level} · {d.rank.name}
              </span>
            </span>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <div
              className="bg-surface-raised flex h-[52px] items-center justify-center gap-2 rounded-[14px]"
              aria-label={`${d.streak.current} day streak`}
            >
              <Icon name="fire" size={22} className="text-gold" />
              <span className="num text-[20px] font-semibold">{d.streak.current}</span>
            </div>
            <Link
              href="/shop"
              data-wallet
              className="bg-surface-raised flex h-[52px] items-center justify-center gap-2 rounded-[14px]"
              aria-label={`${formatNumber(d.sparks)} Sparks`}
            >
              <Icon name="lightning" size={20} className="text-gold" />
              <span className="num text-gold text-[20px] font-semibold">{formatNumber(d.sparks)}</span>
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[15px] font-semibold">
              <span>Today</span>
              <span className="num">
                <span className="text-accent">{done}</span> / {LAUNCH_IDS.length}
              </span>
            </div>
            <ol
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${LAUNCH_IDS.length}, 1fr)` }}
              aria-label="Today's featured Dailies"
            >
              {LAUNCH_IDS.map((id) => {
                const c = cleared[id] !== undefined;
                return (
                  <li
                    key={id}
                    title={GAME_BY_ID[id].name}
                    className="h-5 rounded-[5px]"
                    style={{ background: c ? "var(--accent)" : "var(--surface-raised)" }}
                  >
                    <span className="sr-only">
                      {GAME_BY_ID[id].name}, {c ? "cleared" : "not cleared"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <Link
            href={nextMeta ? `/play/${nextMeta.id}` : "/library"}
            className="toy bg-accent text-on-accent flex h-16 items-center justify-center gap-2.5 rounded-[20px]"
            style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
          >
            <Icon name={nextMeta ? "play" : "infinity"} size={20} />
            <span className="font-display text-[18px] font-black">{nextMeta ? `Play ${nextMeta.name}` : "Play anytime"}</span>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/duel"
              className="toy bg-surface-raised font-display flex h-14 items-center justify-center gap-2 rounded-[18px] text-[15px] font-extrabold"
            >
              <Icon name="sword" size={18} />
              Duel
            </Link>
            <Link
              href="/party"
              className="toy bg-surface-raised font-display flex h-14 items-center justify-center gap-2 rounded-[18px] text-[15px] font-extrabold"
            >
              <Icon name="users-three" size={18} />
              Party
            </Link>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Friends online</h2>
            <Link href="/friends" className="text-accent text-[14px] font-medium">
              All
            </Link>
          </div>
          {friends.isPending ? (
            <Skeleton className="h-10 rounded-[12px]" />
          ) : online.length === 0 ? (
            <p className="text-muted text-[14px]">
              Nobody online right now.{" "}
              <Link href="/friends" className="text-accent font-medium">
                Invite a friend
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {online.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5">
                  <Link href={`/u/${f.nickname}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <AvatarChip nickname={f.nickname} color={f.color} size={34} radius={11} online ring="var(--surface)" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-semibold">{f.nickname}</span>
                      <span className="text-muted truncate text-[12px] font-medium">{f.presence.label}</span>
                    </span>
                  </Link>
                  <Link
                    href={`/duel?friend=${encodeURIComponent(f.nickname)}`}
                    aria-label={`Duel ${f.nickname}`}
                    className="press bg-surface-raised text-accent flex size-11 items-center justify-center rounded-[12px]"
                  >
                    <Icon name="sword" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}
