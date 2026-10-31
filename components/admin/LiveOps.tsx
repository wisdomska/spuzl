"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { addDays, clock, compact, dayMonth, todayIso } from "@/lib/admin/dates";
import { GAME_BY_ID } from "@/lib/catalog";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { Notice, PageTitle, RowsSkeleton } from "./ui";

interface Live {
  now: string;
  kpis: { players_now: number; dau: number; dau_yesterday: number; dau_last_week: number; clears_today: number; flagged: number; open_reports: number };
  retention: { d1: number | null; d1_cohort: number; d7: number | null; d7_cohort: number };
  byGame: { game_id: string; name: string; world: string; clears: number; median_ms: number | null; free_clears: number }[];
  streaks: { bucket: string; players: number }[];
  series: { slot_start: string; players: number }[];
  alerts: { gaps: { game: string; date: string }[]; gapCount: number; unlocked: number };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${iso.slice(11, 16)} GMT`;
};
const delta = (now: number, then: number) => (then > 0 ? `${now >= then ? "+" : ""}${Math.round(((now - then) / then) * 100)}%` : null);

function Kpi({ label, value, sub, subTone }: { label: string; value: string; sub: string; subTone?: "ok" | "danger" }) {
  return (
    <div className="bg-surface flex flex-col gap-1 rounded-[12px] p-3.5">
      <span className="text-muted text-[13px] font-medium">{label}</span>
      <span className="num text-[28px] font-semibold">{value}</span>
      <span className={`num text-[12px] font-semibold ${subTone === "ok" ? "text-accent" : subTone === "danger" ? "text-danger" : "text-muted"}`}>{sub}</span>
    </div>
  );
}

function Alert({ tone, icon, children, action }: { tone: "danger" | "warn" | "neutral"; icon: string; children: ReactNode; action?: ReactNode }) {
  const ring = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--gold)" : "var(--line)";
  const bg = tone === "danger" ? "var(--danger-tint)" : tone === "warn" ? "var(--warn-tint)" : "var(--surface)";
  const fg = tone === "danger" ? "text-danger" : tone === "warn" ? "text-gold" : "text-muted";
  return (
    <div className="flex min-h-[46px] items-center gap-2.5 rounded-[12px] px-3.5 py-3 text-[14px] font-medium" style={{ background: bg, boxShadow: `inset 0 0 0 1px ${ring}` }}>
      <Icon name={icon} size={20} className={fg} />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

/** Live ops dashboard (design: Admin live ops), FR-AD-06. Refreshes every minute. */
export function LiveOps({ canLock, canModerate }: { canLock: boolean; canModerate: boolean }) {
  const q = useAdminQuery<Live>(["liveops"], "/api/admin/liveops", { refetchInterval: 60_000 });
  const lock = useAdminAction<{ through: string }>("POST", "/api/admin/dailies/lock");
  if (q.isPending) return <RowsSkeleton rows={10} height={56} />;
  if (q.error)
    return (
      <div className="p-6">
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      </div>
    );
  const d = q.data;
  const k = d.kpis;
  const dauDelta = delta(k.dau, k.dau_last_week);
  const peak = Math.max(1, ...d.series.map((s) => s.players));
  const top = d.byGame.slice(0, 8);
  const most = Math.max(1, ...top.map((g) => g.clears + g.free_clears));
  const streakMax = Math.max(1, ...d.streaks.map((s) => s.players));
  const label = (i: number) => (i === d.series.length - 1 ? "now" : d.series[i]?.slot_start.slice(11, 16));
  const lastWeekDay = DAYS[new Date(addDays(todayIso(), -7) + "T00:00:00Z").getUTCDay()];

  return (
    <div className="flex min-h-dvh flex-col gap-3.5 px-6 py-5">
      <PageTitle title="Live ops">
        <span className="num text-accent flex items-center gap-1.5 text-[13px] font-semibold">
          <span aria-hidden className="bg-accent size-2 rounded-full" />
          live · {stamp(d.now)}
        </span>
      </PageTitle>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Players now" value={k.players_now.toLocaleString("en-US")} sub="seen in the last 5 min" />
        <Kpi label="DAU" value={compact(k.dau)} sub={dauDelta ? `${dauDelta} vs last ${lastWeekDay}` : `${compact(k.dau_yesterday)} yesterday`} subTone={dauDelta?.startsWith("+") ? "ok" : undefined} />
        <Kpi label="D1 retention" value={d.retention.d1 === null ? "n/a" : `${d.retention.d1}%`} sub={`cohort ${d.retention.d1_cohort.toLocaleString("en-US")}`} />
        <Kpi label="D7 retention" value={d.retention.d7 === null ? "n/a" : `${d.retention.d7}%`} sub={`cohort ${d.retention.d7_cohort.toLocaleString("en-US")}`} />
        <Kpi label="Flagged scores" value={k.flagged.toLocaleString("en-US")} sub={`${k.open_reports} open reports`} subTone={k.flagged ? "danger" : undefined} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="ccu" className="bg-surface flex min-h-[320px] flex-col gap-2.5 rounded-[12px] p-4">
          <h2 id="ccu" className="text-[14px] font-bold">
            Active players, last 24 h
          </h2>
          <div className="flex flex-1 items-end gap-[3px]" role="img" aria-label={`Peak ${peak} players in a 30 minute slot; ${d.series.at(-1)?.players ?? 0} in the current slot`}>
            {d.series.map((s, i) => (
              <span
                key={s.slot_start}
                title={`${s.slot_start.slice(11, 16)} GMT: ${s.players}`}
                className="flex-1 rounded-t-[2px]"
                style={{ height: `${Math.max(2, (s.players / peak) * 98)}%`, background: i === d.series.length - 1 ? "var(--accent)" : "var(--admin-bar)" }}
              />
            ))}
          </div>
          <div className="num text-muted flex justify-between text-[12px] font-medium">
            {[0, 12, 24, 36, d.series.length - 1].map((i) => (
              <span key={i}>{label(i)}</span>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3.5">
          <section aria-labelledby="bygame" className="bg-surface flex flex-col gap-2.5 rounded-[12px] p-4">
            <h2 id="bygame" className="text-[14px] font-bold">
              Today by game · clears and median time
            </h2>
            {top.every((g) => !g.clears && !g.free_clears) && <span className="text-muted text-[13px]">No clears yet today.</span>}
            {top.map((g) => (
              <div key={g.game_id} className="flex items-center gap-2.5 text-[13px] font-medium">
                <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--w-${g.world})` }} />
                <span className="w-[86px] truncate">{g.name}</span>
                <div className="bg-line h-2 flex-1 overflow-hidden rounded-[4px]">
                  <div className="h-full origin-left" style={{ width: `${((g.clears + g.free_clears) / most) * 100}%`, background: `var(--w-${g.world})` }} />
                </div>
                <span className="num w-14 text-right text-[12px] font-semibold" title={`${g.clears} Daily clears, ${g.free_clears} Free play clears`}>
                  {compact(g.clears + g.free_clears)}
                </span>
                <span className="num text-muted w-11 text-right text-[12px] font-medium">{clock(g.median_ms) || "n/a"}</span>
              </div>
            ))}
          </section>
          <section aria-labelledby="streaks" className="bg-surface flex flex-col gap-2 rounded-[12px] p-4">
            <h2 id="streaks" className="text-[14px] font-bold">
              Streak distribution · current streak in days
            </h2>
            {d.streaks.map((s) => (
              <div key={s.bucket} className="flex items-center gap-2.5 text-[13px] font-medium">
                <span className="num text-muted w-[72px] text-[12px]">{s.bucket}</span>
                <div className="bg-line h-2 flex-1 overflow-hidden rounded-[4px]">
                  <div className="bg-accent h-full" style={{ width: `${(s.players / streakMax) * 100}%` }} />
                </div>
                <span className="num w-14 text-right text-[12px] font-semibold">{compact(s.players)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
        {d.alerts.gapCount ? (
          <Alert
            tone="danger"
            icon="warning"
            action={
              <Link href={`/admin/calendar/${d.alerts.gaps[0].game}/${d.alerts.gaps[0].date}`} className="text-accent text-[13px] font-semibold hover:underline">
                Fix
              </Link>
            }
          >
            {d.alerts.gapCount === 1
              ? `${GAME_BY_ID[d.alerts.gaps[0].game]?.name} ${dayMonth(d.alerts.gaps[0].date)} missing`
              : `${d.alerts.gapCount} Dailies missing in the next 7 days`}
          </Alert>
        ) : (
          <Alert tone="neutral" icon="check-circle">
            Every Daily for the next 7 days is scheduled
          </Alert>
        )}
        {d.alerts.unlocked ? (
          <Alert
            tone="warn"
            icon="lock-simple-open"
            action={
              canLock ? (
                <button type="button" disabled={lock.isPending} onClick={() => lock.mutate({ through: addDays(todayIso(), 7) })} className="text-accent text-[13px] font-semibold hover:underline">
                  Lock
                </button>
              ) : undefined
            }
          >
            {d.alerts.unlocked} Dailies inside 7 days are unlocked
          </Alert>
        ) : (
          <Alert tone="neutral" icon="lock-simple">
            The next 7 days are locked
          </Alert>
        )}
        <Alert
          tone={k.flagged ? "warn" : "neutral"}
          icon="flag"
          action={
            canModerate ? (
              <Link href="/admin/moderation" className="text-accent text-[13px] font-semibold hover:underline">
                View
              </Link>
            ) : undefined
          }
        >
          {k.flagged ? `${k.flagged} flagged scores wait for review` : "No flagged scores waiting"}
        </Alert>
      </div>
    </div>
  );
}
