"use client";

/**
 * Metrics (admin overhaul B): the owner's questions first (how many play, do they come back, what they play,
 * together, Sparks and shop, community, first time), each card a big number, what it means, the change on the same
 * number of days before and a small trend. The older detail and app-speed cards sit folded at the bottom. The range
 * is the last 7 or 30 full GMT days (today is on Live now). Numbers come from /api/admin/metrics (Postgres); every
 * card downloads its rows as CSV through an audited POST.
 */
import Link from "next/link";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { addDays, dayMonth, shortDay, todayIso } from "@/lib/admin/dates";
import { api } from "@/lib/client/api";
import { useAdminQuery } from "@/lib/client/admin";
import {
  change,
  changeTone,
  count,
  dailyAverage,
  duration,
  extremes,
  guests,
  INSIGHT_SECTIONS,
  INSIGHTS,
  percent,
  practiceLeft,
  sparkline,
  topGames,
  worldPlays,
  type Change,
  type InsightDef,
  type InsightId,
  type InsightSection,
} from "@/lib/admin/insights";
import {
  METRICS,
  rate,
  RANGE_DAYS,
  type MetricDef,
  type MetricId,
  type MetricRow,
  type MetricsData,
  type RangeDays,
} from "@/lib/admin/metrics";
import { WORLD_BY_ID } from "@/lib/catalog";
import { adminCopy } from "@/lib/copy/admin";
import { Btn, Notice, RowsSkeleton, Tabs } from "./ui";

const C = adminCopy.metrics;
const K = C.cards;
const z = (v: number | undefined) => v ?? 0;

function save(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download button for one card's CSV (audited on the server), with its own error line. */
function CsvButton({ id, title, data }: { id: MetricId | InsightId; title: string; data: MetricsData }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ filename: string; csv: string }>("/api/admin/metrics", {
        method: "POST",
        json: { metric: id, days: data.days, end: data.to },
      });
      save(r.filename, r.csv);
    } catch {
      setErr(C.exportError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex flex-col items-end">
      <Btn size="sm" tone="ghost" icon="download-simple" onClick={run} disabled={busy} aria-label={C.exportAria(title)} className="h-11">
        {C.csv}
      </Btn>
      <span role="status" aria-live="polite" className="text-danger text-[12px] font-medium">
        {err}
      </span>
    </span>
  );
}

/** The supporting line under each owner card's big number. */
function detailLine(id: InsightDef["id"], t: MetricRow, rows: readonly MetricRow[]): string {
  // null when there is nothing to divide by: each sentence then says so in its own words
  const pct = (v: number | null) => percent(v);
  switch (id) {
    case "players":
      return K.players.detail(count(dailyAverage(rows, (r) => z(r.active)) ?? 0), count(z(t.active_saved)), count(guests(t)));
    case "new_players":
      return K.new_players.detail(count(z(t.new_saved)), pct(rate(z(t.new_saved), t.created)));
    case "saved_accounts":
      return K.saved_accounts.detail(count(z(t.active_saved)), count(z(t.active)));
    case "next_day":
      return K.next_day.detail(count(z(t.rt_d1_kept)), count(z(t.rt_d1_cohort)));
    case "week_later":
      return K.week_later.detail(count(z(t.rt_d7_kept)), count(z(t.rt_d7_cohort)));
    case "streaks":
      return K.streaks.detail(count(z(t.streak_7)));
    case "games_played":
      return K.games_played.detail(
        count(z(t.puzzles_cleared)),
        pct(rate(z(t.puzzles_cleared), z(t.puzzles_started))),
        count(z(t.board_plays)),
      );
    case "daily_puzzles":
      return K.daily_puzzles.detail(pct(rate(t.daily_cleared, t.daily_started)), count(t.daily_started));
    case "daily_five_plays":
      return K.daily_five_plays.detail(count(z(t.daily5_full)));
    case "duels_played":
      return K.duels_played.detail(count(z(t.duels_vs_computer)));
    case "parties":
      return K.parties.detail(count(z(t.party_players)));
    case "board_games":
      return K.board_games.detail(count(Math.max(0, z(t.board_games) - z(t.board_bot_games))), count(z(t.board_bot_games)));
    case "friends":
      return K.friends.detail();
    case "sparks_earned":
      return K.sparks_earned.detail(z(t.active) ? count(z(t.sparks_earned) / z(t.active)) : null);
    case "sparks_spent":
      return K.sparks_spent.detail(pct(rate(z(t.sparks_spent), z(t.sparks_earned))));
    case "shop_buys":
      return K.shop_buys.detail(count(z(t.shop_buyers)));
    case "reports":
      return K.reports.detail();
    case "feedback":
      return K.feedback.detail();
    case "onboarding_done":
      return K.onboarding_done.detail(count(z(t.onboarding_home)), count(z(t.onboarding_age)));
    case "first_game":
      return K.first_game.detail(count(t.played), count(t.created));
    case "practice_done":
      return K.practice_done.detail(count(z(t.practice_skipped)), count(practiceLeft(t)));
  }
}

const big = (def: Pick<InsightDef, "format">, v: number | null) =>
  v === null ? C.noData : def.format === "percent" ? (percent(v) ?? C.noData) : count(v);

function ChangeLine({ c, tone, days }: { c: Change | null; tone: "good" | "bad" | "neutral"; days: number }) {
  const text = !c
    ? C.change.none(days)
    : c.dir === "same"
      ? C.change.same(days)
      : c.amount === null
        ? C.change.newNow(days)
        : c.unit === "points"
          ? C.change.points(c.dir, c.amount, days)
          : C.change.percent(c.dir, c.amount, days);
  const cls = tone === "good" ? "text-accent" : tone === "bad" ? "text-danger" : "text-muted";
  return (
    <span className={`flex items-center gap-1 text-[13px] font-semibold ${cls}`}>
      <Icon name={!c || c.dir === "same" ? "minus" : c.dir === "up" ? "arrow-up" : "arrow-down"} size={14} />
      {text}
    </span>
  );
}

/** A small trend line over the range; days with nothing to measure leave a gap. Summarised for screen readers. */
function Trend({ def, label, rows }: { def: InsightDef; label: string; rows: readonly MetricRow[] }) {
  const segs = sparkline(rows.map(def.value));
  const { hi, lo } = extremes(rows, def.value);
  if (!segs.length || !hi || !lo) return <span className="text-muted text-[12px]">{C.trendEmpty}</span>;
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label={C.trendAria(label, big(def, lo.v), dayMonth(lo.date), big(def, hi.v), dayMonth(hi.date))}
    >
      <line x1="0" x2="100" y1="27" y2="27" stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {segs.map((pts, i) =>
        pts.includes(" ") ? (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        ) : (
          <circle key={i} cx={pts.split(",")[0]} cy={pts.split(",")[1]} r="1.5" fill="var(--accent)" />
        ),
      )}
    </svg>
  );
}

function InsightCard({ def, data }: { def: InsightDef; data: MetricsData }) {
  const id = useId();
  const copy = K[def.id];
  const v = def.value(data.total);
  const prev = data.previous ? def.value(data.previous.total) : undefined;
  const c = def.snapshot || !data.previous ? null : change(v, prev, def.format);
  const last7 = def.id === "players" && data.days > 7 ? K.players.last7(count(z(data.total.active_last7))) : null;
  return (
    <section aria-labelledby={id} className="bg-surface flex min-w-0 flex-col gap-2 rounded-[16px] p-4">
      <div className="flex items-start gap-2">
        <h3 id={id} className="flex-1 pt-2 text-[15px] font-bold">
          {copy.label}
        </h3>
        <CsvButton id={def.id} title={copy.label} data={data} />
      </div>
      <span className="num text-[32px] leading-none font-semibold">{big(def, v)}</span>
      {def.snapshot ? (
        <span className="text-muted text-[13px] font-semibold">{C.rightNow}</span>
      ) : data.previous ? (
        <ChangeLine c={c} tone={changeTone(c, def.better)} days={data.days} />
      ) : null}
      <p className="text-[14px] leading-[1.4]">{copy.meaning}</p>
      <p className="num text-muted text-[13px] leading-[1.4]">
        {detailLine(def.id, data.total, data.rows)}
        {last7 && (
          <>
            <br />
            {last7}
          </>
        )}
      </p>
      {!def.snapshot && <Trend def={def} label={copy.label} rows={data.rows} />}
      <details className="mt-auto">
        <summary className="disclosure text-muted hover:text-text flex h-11 cursor-pointer items-center text-[13px] font-semibold">
          {C.howCounted}
        </summary>
        <p className="text-muted text-[13px] leading-[1.45]">{copy.definition}</p>
      </details>
    </section>
  );
}

const TOP = 10;

function TopGames({ data }: { data: MetricsData }) {
  const [all, setAll] = useState(false);
  const id = useId();
  const games = topGames(data.total, data.previous?.total);
  const worlds = worldPlays(data.total);
  const shown = all ? games : games.slice(0, TOP);
  const T = C.topGames;
  return (
    <section aria-labelledby={id} className="bg-surface flex min-w-0 flex-col gap-3 rounded-[16px] p-4 md:col-span-2 xl:col-span-3">
      <div className="flex items-start gap-2">
        <h3 id={id} className="flex-1 pt-2 text-[15px] font-bold">
          {T.title}
        </h3>
        <CsvButton id="top_games" title={T.title} data={data} />
      </div>
      <p className="text-[14px] leading-[1.4]">{T.meaning}</p>
      {!games.length ? (
        <p className="text-muted text-[14px]">{T.empty}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead className="bg-surface sticky top-0">
                <tr className="text-muted text-left text-[12px]">
                  {T.head.map((h, i) => (
                    <th key={h} scope="col" className={`px-2 py-2 font-semibold whitespace-nowrap ${i ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => {
                  const ch = data.previous ? change(g.plays, g.prevPlays, "count") : null;
                  return (
                    <tr key={g.id}>
                      <th scope="row" className="border-line border-t px-2 py-2 text-left font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ background: g.world ? WORLD_BY_ID[g.world]?.color : "var(--line)" }}
                          />
                          {g.name}
                        </span>
                      </th>
                      <td className="num border-line border-t px-2 py-2 text-right">{count(g.plays)}</td>
                      <td className="num border-line border-t px-2 py-2 text-right">{count(g.players)}</td>
                      <td className="num text-muted border-line border-t px-2 py-2 text-right whitespace-nowrap">
                        {!ch
                          ? ""
                          : ch.amount === null
                            ? T.newGame
                            : ch.dir === "same"
                              ? "="
                              : `${ch.dir === "up" ? "+" : "−"}${ch.amount}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {games.length > TOP && (
              <button
                type="button"
                onClick={() => setAll((a) => !a)}
                className="text-accent mt-1 h-11 text-[13px] font-semibold hover:underline"
                aria-expanded={all}
              >
                {all ? T.fewer : T.more(games.length)}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-[13px] font-bold">{T.worlds}</h4>
            {worlds.map((w) => (
              <div key={w.id} className="flex items-center gap-2.5 text-[13px] font-medium">
                <span className="w-[110px] truncate">{w.name ?? T.other}</span>
                <div className="bg-line h-2.5 flex-1 overflow-hidden rounded-[4px]">
                  <div
                    className="h-full"
                    style={{ width: `${w.share ?? 0}%`, background: w.id === "other" ? "var(--muted)" : WORLD_BY_ID[w.id]?.color }}
                  />
                </div>
                <span className="num w-24 text-right text-[12px] font-semibold">
                  {count(w.plays)} · {percent(w.share) ?? C.noData}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <details>
        <summary className="disclosure text-muted hover:text-text flex h-11 cursor-pointer items-center text-[13px] font-semibold">
          {C.howCounted}
        </summary>
        <p className="text-muted text-[13px] leading-[1.45]">{T.definition}</p>
      </details>
    </section>
  );
}

function Section({ section, data }: { section: InsightSection; data: MetricsData }) {
  const id = useId();
  const s = C.sections[section];
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-[17px] font-extrabold">
          {s.title}
        </h2>
        <p className="text-muted text-[13px]">{s.intro}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {INSIGHTS.filter((d) => d.section === section).map((d) => (
          <InsightCard key={d.id} def={d} data={data} />
        ))}
        {section === "play" && <TopGames data={data} />}
      </div>
    </section>
  );
}

const cell = (c: MetricDef["cols"][number], r: MetricRow) => {
  const v = c.value(r);
  if (v === null) return C.notApplicable;
  return c.unit === "ms" ? (duration(v) ?? C.notApplicable) : count(v);
};

/** A detail or app-speed card (folded sections): headline, what it is, a breakdown, and the days. */
function MetricCard({ def, data }: { def: MetricDef; data: MetricsData }) {
  const headId = `m-${def.id}`;
  return (
    <section aria-labelledby={headId} className="bg-surface flex min-w-0 flex-col gap-2 rounded-[16px] p-4">
      <div className="flex items-start gap-2">
        <h3 id={headId} className="flex-1 pt-2 text-[14px] font-bold">
          {def.title}
        </h3>
        <CsvButton id={def.id} title={def.title} data={data} />
      </div>
      <span className="num text-[22px] leading-tight font-semibold sm:text-[26px]">{def.headline(data.total)}</span>
      <span className="num text-muted text-[12px] font-semibold">{def.sub(data.total)}</span>
      <p className="text-muted text-[13px] leading-[1.4]">{def.note}</p>
      {def.breakdown && (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                {def.breakdown.head.map((h, i) => (
                  <th key={h} scope="col" className={`px-2 py-2 font-semibold whitespace-nowrap ${i ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {def.breakdown.rows(data.total).map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="border-line border-t px-2 py-1.5 text-left font-medium">
                    {r.label}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={i} className="num border-line border-t px-2 py-1.5 text-right">
                      {v ?? C.notApplicable}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details>
        <summary className="disclosure text-muted hover:text-text flex h-11 cursor-pointer items-center text-[13px] font-semibold">
          {C.byDay}
        </summary>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0">
              <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                <th scope="col" className="px-2 py-2 font-semibold">
                  {C.day}
                </th>
                {def.cols.map((c) => (
                  <th key={c.key} scope="col" className="px-2 py-2 text-right font-semibold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.rows].reverse().map((r) => (
                <tr key={r.date}>
                  <th scope="row" className="border-line border-t px-2 py-1.5 text-left font-medium whitespace-nowrap">
                    {r.date ? shortDay(r.date) : ""}
                  </th>
                  {def.cols.map((c) => (
                    <td key={c.key} className="num border-line border-t px-2 py-1.5 text-right">
                      {cell(c, r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Folded({ title, intro, group, data }: { title: string; intro: string; group: MetricDef["group"]; data: MetricsData }) {
  return (
    <details className="group">
      <summary className="bg-surface hover:bg-surface-raised flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3">
        <Icon name="caret-right" size={16} className="text-muted transition-transform group-open:rotate-90" />
        <span className="flex flex-col">
          <span className="text-[16px] font-extrabold">{title}</span>
          <span className="text-muted text-[13px]">{intro}</span>
        </span>
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {METRICS.filter((m) => m.group === group).map((m) => (
          <MetricCard key={m.id} def={m} data={data} />
        ))}
      </div>
    </details>
  );
}

export function MetricsPage() {
  const [days, setDays] = useState<RangeDays>(7);
  // Full GMT days only: the range ends yesterday, so every day (and the comparison) is complete.
  const end = addDays(todayIso(), -1);
  const q = useAdminQuery<MetricsData>(["metrics", days, end], `/api/admin/metrics?days=${days}&end=${end}`, { keepPrevious: true });
  const d = q.data;
  return (
    <div className="flex min-h-dvh flex-col gap-5 px-4 py-5 md:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[22px] font-extrabold tracking-[-0.01em]">{C.title}</h1>
          <div className="ml-auto">
            <Tabs
              label={C.range}
              value={String(days)}
              onChange={(v) => setDays(Number(v) as RangeDays)}
              items={RANGE_DAYS.map((n) => ({ id: String(n), label: C.days(n) }))}
            />
          </div>
        </div>
        <p className="text-[14px] leading-[1.45]">{C.purpose}</p>
        {d && (
          <p className="text-muted text-[13px] leading-[1.45]">
            <span className="num text-text font-semibold">{C.span(dayMonth(d.from), dayMonth(d.to))}</span>. {C.todayLeftOut}{" "}
            <Link href="/admin/liveops" className="text-accent font-semibold hover:underline">
              {C.liveNow}
            </Link>
            . {d.previous && C.compare(d.days, dayMonth(d.previous.from), dayMonth(d.previous.to))} {C.allDays}
          </p>
        )}
      </header>
      {q.isPending ? (
        <RowsSkeleton rows={6} height={140} />
      ) : q.error && !d ? (
        <Notice
          tone="danger"
          icon="warning"
          action={
            <Btn size="sm" onClick={() => q.refetch()}>
              {C.retry}
            </Btn>
          }
        >
          {C.loadError}
        </Notice>
      ) : d ? (
        <div className={`flex flex-col gap-6 ${q.isFetching ? "opacity-70" : ""}`} aria-busy={q.isFetching}>
          {INSIGHT_SECTIONS.map((s) => (
            <Section key={s} section={s} data={d} />
          ))}
          <Folded title={C.detail.title} intro={C.detail.intro} group="detail" data={d} />
          <Folded title={C.speed.title} intro={C.speed.intro} group="speed" data={d} />
        </div>
      ) : null}
    </div>
  );
}
