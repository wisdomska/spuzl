"use client";

import { useGameSettings } from "@/lib/game-settings/client";
import Link from "next/link";
import { useMe, useToday } from "@/lib/client/api";
import { useFriends } from "@/lib/client/social";
import { GAME_BY_ID, LAUNCH_IDS } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelSkeleton } from "./SidePanel";
import { AvatarChip } from "@/components/meta/ui";
import { formatNumber } from "@/lib/format";
import { nextDaily } from "./HomeMap";
import { continueGame, continueHref } from "@/lib/game/next";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { BoardThumb } from "./BoardThumb";
import { isLadderGame } from "@/lib/game/levels";
import { useLevels } from "@/lib/client/levels";
import { levelsCopy } from "@/lib/copy/levels";

/**
 * What the desktop right panel shows (`SidePanel`, 360 px; States, Share, Light and Desktop file, "Desktop home"):
 * you, streak and wallet, today's board of featured Dailies, Play next, Duel and Party, friends online. Its own
 * chunk, loaded and rendered only on a wide screen (R3-03), so phones neither download nor hydrate it.
 */
export function SidePanelBody() {
  const me = useMe();
  const today = useToday();
  const friends = useFriends(!!me.data);
  const d = me.data;
  const dailiesOn = useGameSettings()["features.dailies"];
  // Dailies off: the strip shows which featured games the player has tried, not today's Dailies.
  const cleared: Record<string, number> = dailiesOn ? (d?.today.cleared ?? {}) : Object.fromEntries((d?.played ?? []).map((id) => [id, 1]));
  const ready = (id: string) => today.data?.games.find((g) => g.id === id)?.ready ?? id === "crownfall";
  const next = continueGame(d?.recent, null) ?? nextDaily(cleared, ready);
  const nextMeta = next ? GAME_BY_ID[next] : null;
  // R2-18: like Home's Continue card, a ladder game names the level it opens. Shares the cached /levels query.
  const nextLadder = !!d && !!nextMeta && isLadderGame(nextMeta.id);
  const levels = useLevels(nextLadder);
  const nextLevel = nextLadder && nextMeta ? levels.data?.games[nextMeta.id]?.next : undefined;
  const featured = LAUNCH_IDS.filter((id) => cleared[id] !== undefined).length;
  const done = dailiesOn ? Math.max(featured, d?.today.counted ?? 0) : featured;
  const online = (friends.data?.friends ?? []).filter((f) => f.presence.online).slice(0, 6);
  const pct = d ? Math.round((d.xpInto / Math.max(1, d.xpNeed)) * 100) : 0;

  return (
    <>
      {!d ? (
        <PanelSkeleton />
      ) : (
        <>
          <Link href="/me" className="flex items-center gap-3 rounded-[16px]">
            <span
              className="relative flex size-14 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--accent) 0 ${pct}%, var(--line) ${pct}% 100%)` }}
              aria-hidden
            >
              <AvatarChip nickname={d.nickname} color={d.avatar_color} hat={d.hat} me size={46} radius={14} />
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
              <span>{dailiesOn ? "Today" : "Featured games tried"}</span>
              <span className="num">
                <span className="text-accent">{done}</span> / {LAUNCH_IDS.length}
              </span>
            </div>
            <ol
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${LAUNCH_IDS.length}, 1fr)` }}
              aria-label={dailiesOn ? "Today's featured Dailies" : "Featured games tried"}
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
                      {GAME_BY_ID[id].name}, {c ? (dailiesOn ? "cleared" : "tried") : dailiesOn ? "not cleared" : "not tried yet"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <Link
            href={nextMeta ? continueHref(nextMeta.id, { dailiesOn, clearedToday: cleared[nextMeta.id] !== undefined }) : "/library"}
            {...(nextMeta ? PLAY_NAV : {})}
            className="toy bg-accent text-on-accent flex h-16 items-center justify-center gap-2.5 rounded-[20px] px-3"
            style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
          >
            {nextMeta ? <BoardThumb meta={nextMeta} size={40} /> : <Icon name="infinity" size={20} />}
            <span className="flex min-w-0 flex-col">
              <span className="font-display truncate text-[18px] leading-tight font-black">
                {nextMeta ? `${d?.recent?.length ? "Continue" : "Play"} ${nextMeta.name}` : "Play anytime"}
              </span>
              {nextLevel !== undefined && (
                <span className="truncate text-[13px] font-semibold opacity-80">{levelsCopy.level(nextLevel)}</span>
              )}
            </span>
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
                    <AvatarChip nickname={f.nickname} color={f.color} hat={f.hat} size={34} radius={11} online ring="var(--surface)" />
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
    </>
  );
}
