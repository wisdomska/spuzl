"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabPage } from "@/components/meta/TabPage";
import { ErrorState, ListSkeleton, PageTitle } from "@/components/meta/ui";
import { useNow } from "@/components/meta/useNow";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { WORLD_BY_ID } from "@/lib/catalog";
import { useMe } from "@/lib/client/api";
import { fiveHref, nextFiveGame, shareFiveGrid, useDailyFive, type FiveGame } from "@/lib/client/daily-five";
import { readOnboarding } from "@/lib/client/onboarding";
import { dailyFiveCopy as T } from "@/lib/copy/daily-five";
import { isFinished, shareGrid } from "@/lib/daily-five";
import { formatClock, formatCountdown } from "@/lib/format";
import { track } from "@/lib/analytics/track";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { FiveRing } from "./FiveRing";

const STATE_ICON: Record<FiveGame["state"], string> = {
  new: "play",
  in_progress: "play",
  cleared: "check-circle",
  failed: "x-circle",
  flagged: "hourglass",
};

/**
 * /daily (R2-05): today's five, this player's progress and combined score, and once all five are played the
 * share grid (Web Share API, or copy). The deep link a shared grid carries; visitors arrive through onboarding.
 */
export function DailyFiveScreen() {
  const router = useRouter();
  const me = useMe();
  const q = useDailyFive();
  const now = useNow();
  const [status, setStatus] = useState<string | null>(null);

  // No profile yet (a friend's link on a new phone): onboarding first, then straight back here.
  useEffect(() => {
    if (me.isSuccess && me.data === null) router.replace(readOnboarding().introSeen ? "/welcome?return=daily" : "/intro?return=daily");
  }, [me.isSuccess, me.data, router]);

  const v = q.data;
  const next = nextFiveGame(v);
  const left = v ? Math.max(0, q.dataUpdatedAt + v.resetsInMs - now) : 0;
  // A new day began while the page was open: fetch the new five (once per expiry).
  const expired = !!v && left === 0;
  const refetch = q.refetch;
  useEffect(() => {
    if (expired) void refetch();
  }, [expired, refetch]);

  const grid = v?.complete
    ? shareGrid({
        date: v.date,
        score: v.score,
        rows: v.games.map((g) => ({ world: g.world, name: g.name, state: g.state, timeMs: g.timeMs, points: g.points })),
      })
    : null;

  const share = async () => {
    if (!grid) return;
    const r = await shareFiveGrid(grid, T.shareTitle);
    if (r === "shared" || r === "copied") track("daily5_share", { kind: r });
    setStatus(r === "copied" ? T.copied : r === "failed" ? T.copyFailed : null);
  };

  return (
    <TabPage label={T.pageTitle}>
      <PageTitle>{T.pageTitle}</PageTitle>
      {q.isPending ? (
        <ListSkeleton rows={6} height={64} />
      ) : q.error || !v ? (
        <ErrorState title={T.loadFailed} onRetry={() => void q.refetch()} />
      ) : !v.enabled ? (
        <div className="bg-surface flex flex-col items-center gap-3 rounded-[20px] p-6 text-center">
          <Spuz mood="sleepy" size={96} decorative />
          <p className="text-[16px] font-semibold">{T.off}</p>
          <Link href="/" className="press bg-surface-raised flex h-11 items-center rounded-[14px] px-4 text-[15px] font-semibold">
            {T.backToGrid}
          </Link>
        </div>
      ) : (
        <>
          <p className="text-muted text-[15px] leading-normal">{T.pageIntro}</p>
          <section
            aria-label={T.cardAria(v.done, v.total, v.score)}
            className="bg-surface flex items-center gap-3 rounded-[20px] p-3"
            style={{ boxShadow: "inset 0 0 0 2px var(--accent)" }}
          >
            <FiveRing done={v.done} total={v.total} size={56} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-[20px] leading-tight font-black">{T.numbered(v.number)}</span>
              <span className="num text-muted text-[13px] font-semibold">{T.newIn(formatCountdown(left))}</span>
            </div>
            <span className="num text-accent text-[20px] font-black" data-testid="daily-five-score">
              {T.points(v.score)}
            </span>
          </section>

          <ol aria-label={T.pageTitle} className="flex flex-col gap-2">
            {v.games.map((g) => (
              <li key={g.slot}>
                <FiveRow g={g} />
              </li>
            ))}
          </ol>

          {v.complete && grid ? (
            <section aria-labelledby="five-done" className="bg-surface flex flex-col gap-3 rounded-[20px] p-4">
              <div className="flex items-center gap-3">
                <Spuz mood="party" size={64} decorative />
                <div className="flex flex-col">
                  <h2 id="five-done" className="font-display text-[20px] font-black">
                    {T.allDoneTitle}
                  </h2>
                  <p className="text-muted text-[14px]">{T.allDoneBody}</p>
                </div>
              </div>
              <pre
                aria-label={T.gridLabel}
                data-testid="daily-five-grid"
                className="bg-bg rounded-[14px] p-3 font-sans text-[15px] leading-[1.5] whitespace-pre-wrap select-all"
              >
                {grid}
              </pre>
              <Button size="lg" icon="share-network" className="w-full" onClick={() => void share()}>
                {T.share}
              </Button>
              <p role="status" aria-live="polite" className="text-muted min-h-5 text-center text-[14px]">
                {status}
              </p>
            </section>
          ) : next ? (
            <Link
              href={fiveHref(next.game) as never}
              {...PLAY_NAV}
              className="toy bg-accent text-on-accent font-display flex h-[60px] items-center justify-center gap-2 rounded-[20px] text-[16px] font-black"
              style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
            >
              <Icon name="play" size={18} />
              {T.playNext(next.name)}
            </Link>
          ) : null}
        </>
      )}
    </TabPage>
  );
}

function FiveRow({ g }: { g: FiveGame }) {
  const world = WORLD_BY_ID[g.world]?.name ?? g.world;
  const done = isFinished(g.state);
  const inner = (
    <>
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${g.state === "cleared" ? "bg-accent text-on-accent" : "bg-surface-raised"}`}
        aria-hidden
      >
        <Icon name={STATE_ICON[g.state]} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-bold">{g.name}</span>
          {g.kind === "bonus" && (
            <span className="bg-surface-raised text-accent rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold uppercase">{T.bonus}</span>
          )}
        </span>
        <span className="text-muted truncate text-[13px]">
          {world} · {T.states[g.state]}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        {done && g.timeMs != null && <span className="num text-[14px] font-semibold">{formatClock(g.timeMs)}</span>}
        {done && <span className="num text-accent text-[13px] font-bold">{T.points(g.points)}</span>}
        {!done && <Icon name="play" size={18} className="text-accent" />}
      </span>
      <span className="sr-only">{T.stateAria(g.name, world, T.states[g.state])}</span>
    </>
  );
  const cls = "flex min-h-[60px] items-center gap-3 rounded-[16px] bg-surface p-2 pr-3";
  return done ? (
    <div className={cls} data-testid={`five-row-${g.game}`} data-state={g.state}>
      {inner}
    </div>
  ) : (
    <Link href={fiveHref(g.game) as never} {...PLAY_NAV} className={`press ${cls}`} data-testid={`five-row-${g.game}`} data-state={g.state}>
      {inner}
    </Link>
  );
}
