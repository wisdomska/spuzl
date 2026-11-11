"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { addDays, compact, dayMonth, todayIso } from "@/lib/admin/dates";
import { duration } from "@/lib/admin/format";
import { change } from "@/lib/admin/insights";
import { GAME_BY_ID, WORLD_BY_ID, type WorldId } from "@/lib/catalog";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Notice, RowsSkeleton } from "./ui";

const C = adminCopy.liveops;

interface Live {
  now: string;
  kpis: {
    players_now: number;
    dau: number;
    dau_yesterday: number;
    dau_last_week: number;
    clears_today: number;
    flagged: number;
    open_reports: number;
  };
  retention: { d1: number | null; d1_cohort: number; d7: number | null; d7_cohort: number };
  byGame: { game_id: string; name: string; world: string; clears: number; median_ms: number | null; free_clears: number }[];
  streaks: { bucket: string; players: number }[];
  series: { slot_start: string; players: number }[];
  alerts: { gaps: { game: string; date: string }[]; gapCount: number; unlocked: number };
}

const { DAYS, MONTHS } = C;
const stamp = (iso: string) => {
  const d = new Date(iso);
  return C.stamp(DAYS[d.getUTCDay()], d.getUTCDate(), MONTHS[d.getUTCMonth()], iso.slice(11, 16));
};
const n = (v: number) => v.toLocaleString("en-US");
const worldColor = (w: string) => WORLD_BY_ID[w as WorldId]?.color ?? "var(--line)";

function Kpi({
  label,
  value,
  sub,
  help,
  subTone,
}: {
  label: string;
  value: string;
  sub: string;
  help?: string;
  subTone?: "ok" | "danger";
}) {
  return (
    <div className="bg-surface flex flex-col gap-1 rounded-[16px] p-4" title={help}>
      <span className="text-[14px] font-semibold">{label}</span>
      <span className="num text-[30px] leading-tight font-semibold">{value}</span>
      <span
        className={`text-[13px] leading-[1.35] font-medium ${subTone === "ok" ? "text-accent" : subTone === "danger" ? "text-danger" : "text-muted"}`}
      >
        {sub}
      </span>
    </div>
  );
}

function Alert({
  tone,
  icon,
  children,
  action,
}: {
  tone: "danger" | "warn" | "neutral";
  icon: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const ring = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--gold)" : "var(--line)";
  const bg = tone === "danger" ? "var(--danger-tint)" : tone === "warn" ? "var(--warn-tint)" : "var(--surface)";
  const fg = tone === "danger" ? "text-danger" : tone === "warn" ? "text-gold" : "text-accent";
  return (
    <div
      className="flex min-h-[52px] flex-wrap items-center gap-2.5 rounded-[16px] px-4 py-3 text-[14px] font-medium"
      style={{ background: bg, boxShadow: `inset 0 0 0 1px ${ring}` }}
    >
      <Icon name={icon} size={20} className={fg} />
      <span className="min-w-[200px] flex-1">{children}</span>
      {action}
    </div>
  );
}

const actionCls = "text-accent inline-flex h-11 items-center px-1 text-[14px] font-semibold hover:underline";

/** Live now (was Live ops), FR-AD-06: what is happening right now and today, and what needs fixing. Refreshes every minute. */
export function LiveOps({ canLock, canModerate }: { canLock: boolean; canModerate: boolean }) {
  const q = useAdminQuery<Live>(["liveops"], "/api/admin/liveops", { refetchInterval: 60_000 });
  const lock = useAdminAction<{ through: string }>("POST", "/api/admin/dailies/lock");
  const ids = { attention: useId(), ccu: useId(), bygame: useId(), streaks: useId(), today: useId() };
  if (q.isPending) return <RowsSkeleton rows={10} height={56} />;
  if (q.error)
    return (
      <div className="p-6">
        <Notice tone="danger" icon="warning">
          {C.loadError} ({errorText(q.error)})
        </Notice>
      </div>
    );
  const d = q.data;
  const k = d.kpis;
  const vsWeek = k.dau_last_week > 0 ? change(k.dau, k.dau_last_week, "count") : null;
  const peak = Math.max(1, ...d.series.map((s) => s.players));
  const top = d.byGame.filter((g) => g.clears || g.free_clears).slice(0, 8);
  const most = Math.max(1, ...top.map((g) => g.clears + g.free_clears));
  const streakMax = Math.max(1, ...d.streaks.map((s) => s.players));
  const label = (i: number) => (i === d.series.length - 1 ? C.now : d.series[i]?.slot_start.slice(11, 16));
  const lastWeekDay = DAYS[new Date(addDays(todayIso(), -7) + "T00:00:00Z").getUTCDay()];
  const problems = (d.alerts.gapCount ? 1 : 0) + (d.alerts.unlocked ? 1 : 0) + (k.flagged ? 1 : 0);
  const gap = d.alerts.gaps[0];

  return (
    <div className="flex min-h-dvh flex-col gap-5 px-4 py-5 md:px-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-[22px] font-extrabold tracking-[-0.01em]">{C.title}</h1>
          <span className="num text-accent flex items-center gap-1.5 text-[13px] font-semibold">
            <span aria-hidden className="bg-accent size-2 rounded-full" />
            {C.live(stamp(d.now))}
          </span>
        </div>
        <p className="text-[14px] leading-[1.45]">{C.purpose}</p>
      </header>

      <section aria-labelledby={ids.attention} className="flex flex-col gap-2.5">
        <h2 id={ids.attention} className="text-[17px] font-extrabold">
          {C.needsAction}
        </h2>
        {!problems && <p className="text-muted text-[14px]">{C.allGood}</p>}
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
          {d.alerts.gapCount ? (
            <Alert
              tone="danger"
              icon="warning"
              action={
                <Link href={`/admin/calendar/${gap.game}/${gap.date}`} className={actionCls}>
                  {C.fix}
                </Link>
              }
            >
              {d.alerts.gapCount === 1 ? C.oneGap(GAME_BY_ID[gap.game]?.name ?? gap.game, dayMonth(gap.date)) : C.gaps(d.alerts.gapCount)}
            </Alert>
          ) : (
            <Alert tone="neutral" icon="check-circle">
              {C.noGaps}
            </Alert>
          )}
          {d.alerts.unlocked ? (
            <Alert
              tone="warn"
              icon="lock-simple-open"
              action={
                canLock ? (
                  <button
                    type="button"
                    disabled={lock.isPending}
                    onClick={() => lock.mutate({ through: addDays(todayIso(), 7) })}
                    className={`${actionCls} disabled:opacity-50`}
                  >
                    {lock.isPending ? C.locking : C.lock}
                  </button>
                ) : (
                  <span className="text-muted text-[13px]">{C.noLockRole}</span>
                )
              }
            >
              {C.unlocked(d.alerts.unlocked)}
            </Alert>
          ) : (
            <Alert tone="neutral" icon="lock-simple">
              {C.allLocked}
            </Alert>
          )}
          <Alert
            tone={k.flagged ? "warn" : "neutral"}
            icon={k.flagged ? "flag" : "check-circle"}
            action={
              k.flagged && canModerate ? (
                <Link href="/admin/moderation" className={actionCls}>
                  {C.view}
                </Link>
              ) : undefined
            }
          >
            {k.flagged ? C.flaggedWaiting(k.flagged) : C.noFlagged}
          </Alert>
        </div>
        <p role="status" aria-live="polite" className="text-[13px] font-medium">
          {lock.isSuccess ? C.locked : lock.isError ? <span className="text-danger">{C.lockFailed}</span> : null}
        </p>
      </section>

      <section aria-labelledby={ids.today} className="flex flex-col gap-2.5">
        <h2 id={ids.today} className="sr-only">
          {C.dau}
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi label={C.playersNow} value={n(k.players_now)} sub={C.playersNowSub} />
          <Kpi
            label={C.dau}
            value={n(k.dau)}
            help={C.dauSub}
            sub={vsWeek && vsWeek.amount !== null ? C.vsLast(vsWeek.dir, vsWeek.amount, lastWeekDay) : C.yesterday(n(k.dau_yesterday))}
            subTone={vsWeek?.dir === "up" ? "ok" : undefined}
          />
          <Kpi
            label={C.d1}
            value={d.retention.d1 === null ? C.notApplicable : C.percent(d.retention.d1)}
            sub={C.cohort(n(d.retention.d1_cohort))}
          />
          <Kpi
            label={C.d7}
            value={d.retention.d7 === null ? C.notApplicable : C.percent(d.retention.d7)}
            sub={C.cohort(n(d.retention.d7_cohort))}
          />
          <Kpi label={C.flagged} value={n(k.flagged)} sub={C.openReports(k.open_reports)} subTone={k.flagged ? "danger" : undefined} />
        </div>
      </section>

      <div className="grid flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby={ids.ccu} className="bg-surface flex min-h-[320px] flex-col gap-2.5 rounded-[16px] p-4">
          <div>
            <h2 id={ids.ccu} className="text-[15px] font-bold">
              {C.active}
            </h2>
            <p className="text-muted text-[13px]">{C.activeIntro}</p>
          </div>
          <div className="flex flex-1 items-end gap-[3px]" role="img" aria-label={C.activeAria(peak, d.series.at(-1)?.players ?? 0)}>
            {d.series.map((s, i) => (
              <span
                key={s.slot_start}
                title={C.slotTitle(s.slot_start.slice(11, 16), s.players)}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: `${Math.max(2, (s.players / peak) * 98)}%`,
                  background: i === d.series.length - 1 ? "var(--accent)" : "var(--admin-bar)",
                }}
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
          <section aria-labelledby={ids.bygame} className="bg-surface flex flex-col gap-2.5 rounded-[16px] p-4">
            <div>
              <h2 id={ids.bygame} className="text-[15px] font-bold">
                {C.byGame}
              </h2>
              <p className="text-muted text-[13px]">{C.byGameIntro}</p>
            </div>
            {!top.length && <span className="text-muted text-[14px]">{C.noClears}</span>}
            {top.map((g) => (
              <div key={g.game_id} className="flex items-center gap-2.5 text-[13px] font-medium">
                <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: worldColor(g.world) }} />
                <span className="w-[96px] truncate">{g.name}</span>
                <div className="bg-line h-2 flex-1 overflow-hidden rounded-[4px]">
                  <div
                    className="h-full origin-left"
                    style={{ width: `${((g.clears + g.free_clears) / most) * 100}%`, background: worldColor(g.world) }}
                  />
                </div>
                <span className="num w-12 text-right text-[13px] font-semibold" title={C.clearsTitle(g.clears, g.free_clears)}>
                  {compact(g.clears + g.free_clears)}
                </span>
                <span className="num text-muted w-[92px] text-right text-[12px] font-medium">
                  {duration(g.median_ms) ? C.typicalTime(duration(g.median_ms)!) : ""}
                </span>
              </div>
            ))}
          </section>
          <section aria-labelledby={ids.streaks} className="bg-surface flex flex-col gap-2 rounded-[16px] p-4">
            <div>
              <h2 id={ids.streaks} className="text-[15px] font-bold">
                {C.streaks}
              </h2>
              <p className="text-muted text-[13px]">{C.streaksIntro}</p>
            </div>
            {d.streaks.map((s) => (
              <div key={s.bucket} className="flex items-center gap-2.5 text-[13px] font-medium">
                <span className="num text-muted w-[92px] text-[12px]">{C.streakBucket(s.bucket)}</span>
                <div className="bg-line h-2 flex-1 overflow-hidden rounded-[4px]">
                  <div className="bg-accent h-full" style={{ width: `${(s.players / streakMax) * 100}%` }} />
                </div>
                <span className="num w-14 text-right text-[13px] font-semibold">{compact(s.players)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
