"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { dailyFiveCopy as T } from "@/lib/copy/daily-five";
import { fiveHref, nextFiveGame, useDailyFive } from "@/lib/client/daily-five";
import { FiveRing } from "./FiveRing";

/**
 * Home's Daily Five card, above the world map (R2-05): the progress ring (0 to 5 played), the combined score, and
 * one tap to the next game not played yet. When all five are done it opens /daily for the share grid. Hidden
 * while the Daily Five is off or could not load (Home never waits on it).
 */
export function DailyFiveCard() {
  const q = useDailyFive();
  const v = q.data;
  if (!v?.enabled || !v.games.length) return null;
  const next = nextFiveGame(v);
  const href = next ? fiveHref(next.game) : "/daily";
  const sub = v.complete ? T.cardDone : v.done === 0 ? T.cardStart : next ? T.cardNext(next.name) : T.cardStart;
  return (
    <Link
      href={href as never}
      {...(next ? PLAY_NAV : {})}
      data-testid="daily-five-card"
      className="press bg-surface flex min-h-[64px] min-w-0 items-center gap-3 rounded-[20px] py-2 pr-4 pl-2"
      style={{ boxShadow: "inset 0 0 0 2px var(--accent)" }}
    >
      <FiveRing done={v.done} total={v.total} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display truncate text-[17px] leading-tight font-black">{T.numbered(v.number)}</span>
        <span className="text-muted truncate text-[13px] font-semibold">{sub}</span>
        <span className="sr-only">. {T.cardAria(v.done, v.total, v.score)}</span>
      </span>
      <span className="num text-accent shrink-0 text-[15px] font-black" aria-hidden>
        {T.points(v.score)}
      </span>
      <Icon name={v.complete ? "share-network" : "play"} size={20} className="text-accent shrink-0" />
    </Link>
  );
}
