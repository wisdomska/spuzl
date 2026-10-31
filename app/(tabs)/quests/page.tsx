"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useBadges, useClaimQuest, useQuests, type QuestDTO } from "@/lib/client/social";
import { useMe } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { Bar, ErrorState, Hex, ListSkeleton, PageTitle, Segmented } from "@/components/meta/ui";
import { BadgeGrid } from "@/components/meta/Badges";
import { flySparks } from "@/components/meta/sparks";
import { Spuz } from "@/components/brand/Spuz";
import { Icon } from "@/components/ui/Icon";
import { chainStates } from "@/lib/meta";
import { formatCountdown, formatNumber } from "@/lib/format";
import { formatLeft } from "@/lib/leagues";

/** S4 Quests and badges: 3 daily quests, the weekly 5-step chain, timers, claim (idempotent on the server). */
export default function QuestsPage() {
  return (
    <Suspense>
      <Quests />
    </Suspense>
  );
}

function Quests() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"quests" | "badges">(params.get("tab") === "badges" ? "badges" : "quests");
  const me = useMe();
  return (
    <TabPage label="Quests">
      <PageTitle
        right={
          <span data-wallet className="bg-surface-raised flex h-10 items-center gap-1.5 rounded-[14px] px-3" aria-label={`${formatNumber(me.data?.sparks ?? 0)} Sparks`}>
            <Icon name="lightning" size={18} className="text-gold" />
            <span className="num text-gold text-[17px] font-semibold">{formatNumber(me.data?.sparks ?? 0)}</span>
          </span>
        }
      >
        Quests
      </PageTitle>
      <Segmented
        label="Quests or badges"
        items={[
          { id: "quests", label: "Quests" },
          { id: "badges", label: "Badges" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "quests" ? <QuestList /> : <BadgesTab />}
    </TabPage>
  );
}

function BadgesTab() {
  const q = useBadges();
  if (q.isPending) return <ListSkeleton rows={4} height={90} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return <BadgeGrid data={q.data} />;
}

function QuestList() {
  const q = useQuests();
  const [now, setNow] = useState(() => Date.now());
  const loaded = useRef(Date.now());
  useEffect(() => {
    if (q.dataUpdatedAt) loaded.current = q.dataUpdatedAt;
  }, [q.dataUpdatedAt]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (q.isPending) return <ListSkeleton rows={3} height={68} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const d = q.data;
  const elapsed = now - loaded.current;
  const states = chainStates(d.weekly.map((w) => ({ completed: w.completed })));
  const doneCount = states.filter((s) => s === "done").length;
  const current = d.weekly.find((_, i) => states[i] === "current");
  const last = d.weekly[d.weekly.length - 1];

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold">Daily</h2>
        <span className="num text-muted text-[14px] font-medium" aria-label={`Daily quests reset in ${formatCountdown(d.resetsInMs - elapsed)}`}>
          resets {formatCountdown(d.resetsInMs - elapsed)}
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {d.daily.map((x) => (
          <li key={x.id}>
            <QuestCard q={x} />
          </li>
        ))}
      </ul>

      <div className="mt-1.5 flex items-center justify-between">
        <h2 className="text-[16px] font-bold">Weekly chain</h2>
        <span className="text-muted text-[14px] font-medium">
          {doneCount} of {d.weekly.length} · <span className="num">{formatLeft(d.weekResetsInMs - elapsed)}</span> left
        </span>
      </div>
      <ol className="flex items-center px-1 py-1.5" aria-label="Weekly chain">
        {d.weekly.map((w, i) => {
          const s = states[i];
          const isLast = i === d.weekly.length - 1;
          const bg = s === "done" ? "var(--accent)" : isLast ? "var(--gold)" : "var(--surface-raised)";
          const icon = s === "done" ? "check" : isLast ? "gift" : s === "current" ? (w.icon ?? "star") : "lock-simple";
          return (
            <li key={w.id} className="flex items-center" style={{ flex: isLast ? "none" : 1 }} aria-label={`Step ${i + 1}: ${w.title}, ${s === "done" ? "done" : s === "current" ? `${w.progress} of ${w.target}` : "locked"}`}>
              <Hex w={48} h={52} bg={bg}>
                <Icon name={icon} size={20} style={{ color: s === "done" || isLast ? "#0E0F1A" : s === "current" ? "var(--accent)" : "var(--text-muted)" }} />
              </Hex>
              {!isLast && <span aria-hidden className="h-1 flex-1" style={{ background: s === "done" ? "var(--accent)" : "var(--line)" }} />}
            </li>
          );
        })}
      </ol>
      {d.weekly
        .filter((w) => w.completed && !w.claimed)
        .map((w) => (
          <QuestCard key={w.id} q={w} />
        ))}
      {current && <QuestCard q={current} />}
      <div className="bg-surface flex items-center gap-3 rounded-[18px] p-3.5">
        <Spuz mood="thinking" size={64} still decorative />
        <p className="flex-1 text-[15px] leading-[1.4] font-medium">
          {current
            ? `Next: ${current.title.charAt(0).toLowerCase()}${current.title.slice(1)}. Finish all 5 for ${last.sparks} Sparks and ${last.xp} XP.`
            : "Chain done for the week. A new one starts Monday."}
        </p>
      </div>
    </>
  );
}

function QuestCard({ q }: { q: QuestDTO }) {
  const claim = useClaimQuest();
  const ref = useRef<HTMLButtonElement>(null);
  const claimable = q.completed && !q.claimed;
  const pct = q.target ? q.progress / q.target : 0;
  const onClaim = async () => {
    const r = await claim.mutateAsync(q.id);
    if (r.sparks > 0) await flySparks(ref.current, r.sparks);
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-[18px] px-3.5 py-3 ${claimable ? "claim-pop" : ""}`}
      style={{ background: claimable ? "var(--success-tint)" : "var(--surface)", boxShadow: claimable ? "inset 0 0 0 2px var(--accent)" : undefined }}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
        style={{
          background: claimable ? "var(--accent)" : "var(--surface-raised)",
          color: claimable ? "#0E0F1A" : q.claimed ? "var(--accent)" : "var(--text)",
        }}
      >
        <Icon name={q.icon} size={22} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[15px] leading-tight font-semibold">{q.title}</span>
        <div className="flex items-center gap-2">
          <Bar value={pct} label={`${q.title}, ${q.progress} of ${q.target}`} />
          <span className="num text-muted text-[12px] font-medium" aria-hidden>
            {q.progress}/{q.target}
          </span>
        </div>
      </div>
      {claimable ? (
        <button
          ref={ref}
          onClick={onClaim}
          disabled={claim.isPending}
          className="press bg-accent text-on-accent h-11 shrink-0 rounded-[12px] px-3 text-[14px] font-bold whitespace-nowrap"
          aria-label={`Claim ${q.sparks} Sparks and ${q.xp} XP`}
        >
          Claim {q.sparks}
        </button>
      ) : q.claimed ? (
        <span className="text-muted shrink-0 px-2 text-[14px] font-bold">Claimed</span>
      ) : (
        <span className="bg-surface-raised text-gold num shrink-0 rounded-[12px] px-3 py-2 text-[14px] font-bold" aria-label={`Reward ${q.sparks} Sparks`}>
          +{q.sparks}
        </span>
      )}
    </div>
  );
}
