"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/components/meta/useNow";
import { useLeague } from "@/lib/client/social";
import { TabPage } from "@/components/meta/TabPage";
import { EmptyState, ErrorState, Hex, ListSkeleton } from "@/components/meta/ui";
import { LeagueRow } from "@/components/meta/LeagueRow";
import { LeagueCeremony } from "@/components/meta/LeagueCeremony";
import { Icon } from "@/components/ui/Icon";
import { formatLeft } from "@/lib/leagues";

/** L1 Weekly league: 30 players, top 7 promote, bottom 5 demote, arrows on the zones, countdown to reset. */
export default function LeaguesPage() {
  const q = useLeague();
  const [seen, setSeen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const now = useNow(30_000);

  const l = q.data?.league;
  const ceremony = q.data?.ceremony && q.data.ceremony.leagueId !== seen ? q.data.ceremony : null;
  const members = l?.members ?? [];
  const me = members.find((m) => m.me);
  // Top 10 (or down to just below you), the hidden middle, then the bottom zone (L1 layout).
  const headEnd = Math.max(10, (me?.pos ?? 0) + 1);
  const tailStart = members.length - 3;
  const collapsible = !expanded && members.length > headEnd + 4;
  const shown = collapsible ? [...members.slice(0, headEnd), null, ...members.slice(tailStart)] : members;
  const left = l ? q.dataUpdatedAt + l.endsInMs - now : 0;

  return (
    <TabPage label="Leagues">
      {ceremony && <LeagueCeremony c={ceremony} onDone={() => setSeen(ceremony.leagueId)} />}
      {q.isPending ? (
        <ListSkeleton rows={10} height={44} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !l ? (
        <EmptyState
          mood="thinking"
          title="Clear 1 Daily to join this week's league"
          body="Leagues are 30 Spuzlers. Earn XP all week, the top 7 go up on Monday."
          action={
            <Link
              href="/"
              className="toy bg-accent text-on-accent font-display flex h-[60px] items-center justify-center rounded-[20px] text-[16px] font-black"
              style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
            >
              Play today&apos;s Daily
            </Link>
          }
        />
      ) : (
        <>
          <header className="flex items-center gap-3.5 pt-1 pb-1">
            <Hex w={64} h={72} bg={l.color} label={`${l.name} emblem`}>
              <Icon name={l.icon} size={30} />
            </Hex>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h1 className="font-display text-[22px] font-black">{l.name}</h1>
              <p className="text-muted text-[15px] font-medium">
                {l.next ? `Top 7 go up to ${l.next}` : "The top league. Hold your place."}
              </p>
            </div>
            <div className="flex flex-col items-end" aria-label={`${formatLeft(left)} left this week`}>
              <span className="num text-[18px] font-semibold">{formatLeft(left)}</span>
              <span className="text-muted text-[13px] font-medium">left</span>
            </div>
          </header>
          <ol className="flex flex-col gap-[3px]" aria-label={`${l.name} table, ${members.length} players`}>
            {shown.map((m, i) =>
              m ? (
                <li key={m.id}>
                  <Link href={m.me ? "/me" : `/u/${m.nickname}`} className="block rounded-[12px]">
                    <LeagueRow pos={m.pos} nickname={m.nickname} color={m.color} points={m.points} zone={m.zone} me={m.me} />
                  </Link>
                </li>
              ) : (
                <li key={`gap-${i}`}>
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-muted flex h-11 w-full items-center justify-center text-[15px] font-medium"
                    aria-label={`Show ${tailStart - headEnd} more players`}
                  >
                    … {tailStart - headEnd} more
                  </button>
                </li>
              ),
            )}
          </ol>
          {members.length < 13 && <p className="text-muted px-1 text-[14px]">Fewer than 13 players this week, so nobody drops a league.</p>}
        </>
      )}
      <nav aria-label="Compete" className="flex gap-2 pt-2">
        <Link
          href="/leaderboards"
          className="press bg-surface flex h-11 items-center gap-2 rounded-[12px] px-3.5 text-[15px] font-semibold"
        >
          <Icon name="chart-bar" size={18} className="text-accent" />
          Leaderboards
        </Link>
        <Link href="/quests" className="press bg-surface flex h-11 items-center gap-2 rounded-[12px] px-3.5 text-[15px] font-semibold">
          <Icon name="scroll" size={18} className="text-accent" />
          Quests
        </Link>
      </nav>
    </TabPage>
  );
}
