"use client";

/**
 * Metrics (admin cascade): tap-to-board, onboarding, first move, hints, duels, Daily completion and shares over
 * the last 7 or 30 GMT days. Numbers come from /api/admin/metrics (aggregated in Postgres); each card exports
 * its daily rows as CSV through an audited POST.
 */
import { useState } from "react";
import { dayMonth, shortDay } from "@/lib/admin/dates";
import { api } from "@/lib/client/api";
import { errorText, useAdminQuery } from "@/lib/client/admin";
import { METRICS, RANGE_DAYS, type MetricDef, type MetricsData, type RangeDays } from "@/lib/admin/metrics";
import { Btn, Notice, PageTitle, RowsSkeleton, Tabs } from "./ui";

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

function MetricCard({ def, data }: { def: MetricDef; data: MetricsData }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const headId = `m-${def.id}`;
  const exportCsv = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ filename: string; csv: string }>("/api/admin/metrics", {
        method: "POST",
        json: { metric: def.id, days: data.days, end: data.to },
      });
      save(r.filename, r.csv);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby={headId} className="bg-surface flex min-w-0 flex-col gap-2 rounded-[12px] p-4">
      <div className="flex items-start gap-2">
        <h2 id={headId} className="flex-1 text-[14px] font-bold">
          {def.title}
        </h2>
        <Btn size="sm" tone="ghost" icon="download-simple" onClick={exportCsv} disabled={busy} aria-label={`Export ${def.title} as CSV`}>
          CSV
        </Btn>
      </div>
      <span className="num text-[22px] leading-tight font-semibold sm:text-[28px]">{def.headline(data.total)}</span>
      <span className="num text-muted text-[12px] font-semibold">{def.sub(data.total)}</span>
      <p className="text-muted text-[13px] leading-[1.4]">{def.note}</p>
      {err && (
        <Notice tone="danger" icon="warning">
          {err}
        </Notice>
      )}
      <details>
        <summary className="text-muted hover:text-text flex h-11 cursor-pointer items-center text-[13px] font-semibold">By day</summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                <th scope="col" className="px-2 py-2 font-semibold">
                  Day
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
                      {c.value(r) ?? "n/a"}
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

export function MetricsPage() {
  const [days, setDays] = useState<RangeDays>(7);
  const q = useAdminQuery<MetricsData>(["metrics", days], `/api/admin/metrics?days=${days}`);
  return (
    <div className="flex min-h-dvh flex-col gap-3.5 px-4 py-5 md:px-6">
      <PageTitle
        title="Metrics"
        aside={
          <Tabs
            label="Range"
            value={String(days)}
            onChange={(v) => setDays(Number(v) as RangeDays)}
            items={RANGE_DAYS.map((d) => ({ id: String(d), label: `${d} days` }))}
          />
        }
      >
        {q.data && (
          <span className="num text-muted text-[13px] font-semibold">
            {dayMonth(q.data.from)} to {dayMonth(q.data.to)} GMT
          </span>
        )}
      </PageTitle>
      {q.isPending ? (
        <RowsSkeleton rows={6} height={120} />
      ) : q.error ? (
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 2xl:grid-cols-3">
          {METRICS.map((m) => (
            <MetricCard key={m.id} def={m} data={q.data} />
          ))}
        </div>
      )}
    </div>
  );
}
