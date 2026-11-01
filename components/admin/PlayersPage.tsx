"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { age, todayIso } from "@/lib/admin/dates";
import {
  ACCOUNT_TYPES,
  AGE_BANDS,
  PLAYER_FILTERS,
  PLAYER_FILTER_ALLOWED,
  PLAYER_STATUSES,
  REPORT_FILTERS,
  TEST_FILTERS,
  playerStatuses,
  type BulkAction,
  type PlayerFilterKey,
  type PlayerRow,
  type PlayerStatus,
} from "@/lib/admin/player-filters";
import { PLAYER_SORT } from "@/lib/admin/sorting";
import { api } from "@/lib/client/api";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { ConfirmDialog } from "./ConfirmDialog";
import { Pagination, usePager } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { useDebouncedFilter, useUrlFilters, useUrlSort } from "./useUrlFilters";
import { Btn, Empty, Field, Notice, PageTitle, Pill, RowsSkeleton, inputCls, type PillTone } from "./ui";

const C = adminCopy.players;
type SortKey = (typeof PLAYER_SORT.keys)[number];

export const STATUS_TONE: Record<PlayerStatus, PillTone> = {
  active: "ok",
  banned: "danger",
  temp_banned: "danger",
  ranking_revoked: "warn",
  flagged: "warn",
  test: "neutral",
};

/** Saves a CSV the API returned (no server file, no extra request). */
export function saveCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Players (owner request): every player, guests and signed in, with search, URL filters, server-side sort and
 * pagination. Roles that can act get row selection with the safe bulk actions (ban, revoke ranking); the owner can
 * export. The server checks every permission again and masks emails for roles without personal-data access.
 */
export function PlayersPage({ canModerate, canExport, emailVisible }: { canModerate: boolean; canExport: boolean; emailVisible: boolean }) {
  const [f, setFilters] = useUrlFilters(PLAYER_FILTERS, PLAYER_FILTER_ALLOWED);
  const [search, setSearch] = useDebouncedFilter(f.q, (v) => setFilters({ q: v }, { replace: true }));
  const sort = useUrlSort(PLAYER_SORT);
  const pager = usePager();
  const here = useSearchParams().toString();
  const qs = new URLSearchParams();
  for (const k of Object.keys(PLAYER_FILTERS) as PlayerFilterKey[]) if (f[k] && f[k] !== PLAYER_FILTERS[k]) qs.set(k, f[k]);
  // The SQL default is to hide test accounts; say so explicitly to keep the API call self-describing.
  if (!qs.has("test")) qs.set("test", "exclude");
  const listKey = `${qs}&${sort.query}`;
  const q = useAdminQuery<AdminPage<PlayerRow> & { emailVisible: boolean }>(
    ["players", listKey, pager.query],
    `/api/admin/players?${listKey}&${pager.query}`,
    { keepPrevious: true },
  );

  // Selection belongs to one view: a new filter, sort or page clears it (adjusted during render, not in an effect).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const view = `${listKey}&${pager.query}`;
  const [seenView, setSeenView] = useState(view);
  if (view !== seenView) {
    setSeenView(view);
    setSelected(new Set());
  }
  const selectable = canModerate || canExport;
  const rows = q.data?.rows ?? [];
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [days, setDays] = useState("7");
  const [notice, setNotice] = useState<string | null>(null);
  const run = useAdminAction<
    { action: BulkAction; ids: string[]; reason: string; days?: number | null },
    { done: number; missing: string[] }
  >("POST", "/api/admin/players/bulk");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportCsv = async (ids?: string[]) => {
    setExporting(true);
    setExportError(null);
    try {
      const r = await api<{ filename: string; csv: string; count: number; truncated: boolean }>("/api/admin/players/export", {
        method: "POST",
        json: { search: `${qs}&${sort.query}`, ...(ids && { ids }) },
      });
      saveCsv(r.filename, r.csv);
      setNotice(C.exported(r.count, r.truncated));
    } catch (e) {
      setExportError(errorText(e));
    } finally {
      setExporting(false);
    }
  };

  const filtered = Object.keys(PLAYER_FILTERS).some((k) => f[k as PlayerFilterKey] !== PLAYER_FILTERS[k as PlayerFilterKey]);
  const cols: HeadCol<SortKey>[] = [
    ...(selectable
      ? [
          {
            label: C.head.select,
            content: (
              <input
                type="checkbox"
                aria-label={C.selectAll}
                checked={allOn}
                disabled={!rows.length}
                onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                className="size-5 accent-[var(--accent)]"
              />
            ),
            className: "w-12",
          } satisfies HeadCol<SortKey>,
        ]
      : []),
    { label: C.head.nickname, sort: "nickname" },
    { label: C.head.account, sort: "account" },
    { label: C.head.email },
    { label: C.head.age, sort: "age_band" },
    { label: C.head.level, sort: "level" },
    { label: C.head.sparks, sort: "sparks" },
    { label: C.head.streak, sort: "streak" },
    { label: C.head.reports, sort: "reports" },
    { label: C.head.lastActive, sort: "last_active" },
    { label: C.head.joined, sort: "joined" },
    { label: C.head.status },
  ];
  const select = (key: PlayerFilterKey, label: string, any: string | null, options: readonly string[], text: (o: string) => string) => (
    <Field label={label} htmlFor={`pf-${key}`}>
      <select id={`pf-${key}`} value={f[key]} onChange={(e) => setFilters({ [key]: e.target.value })} className={`${inputCls} h-11 w-40`}>
        {any !== null && <option value="">{any}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {text(o)}
          </option>
        ))}
      </select>
    </Field>
  );
  const dateRange = (fromKey: PlayerFilterKey, toKey: PlayerFilterKey, label: string) => (
    <fieldset className="flex flex-col gap-1">
      <legend className="num text-muted text-[12px] font-semibold">{label}</legend>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label={C.rangeAria(label, C.from)}
          max={f[toKey] || todayIso()}
          value={f[fromKey]}
          onChange={(e) => setFilters({ [fromKey]: e.target.value }, { replace: true })}
          className={`${inputCls} h-11 w-[150px]`}
        />
        <span className="text-muted text-[13px]">{C.to}</span>
        <input
          type="date"
          aria-label={C.rangeAria(label, C.to)}
          min={f[fromKey] || undefined}
          max={todayIso()}
          value={f[toKey]}
          onChange={(e) => setFilters({ [toKey]: e.target.value }, { replace: true })}
          className={`${inputCls} h-11 w-[150px]`}
        />
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6">
      <PageTitle
        title={C.title}
        aside={
          canExport ? (
            <Btn icon="download-simple" disabled={exporting || !q.data?.total} onClick={() => void exportCsv()}>
              {C.exportAll}
            </Btn>
          ) : undefined
        }
      >
        {q.data && <span className="num text-muted text-[14px]">{C.total(fmt(q.data.total))}</span>}
      </PageTitle>
      <p className="text-muted text-[14px]">
        {C.intro} {!emailVisible && C.emailMasked}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={C.search} htmlFor="pf-q">
          <input
            id="pf-q"
            type="search"
            value={search}
            placeholder={emailVisible ? C.searchPlaceholderPii : C.searchPlaceholder}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} h-11 w-72 max-w-full`}
          />
        </Field>
        {select("account", C.account, C.anyAccount, ACCOUNT_TYPES, (o) => C.accounts[o as keyof typeof C.accounts])}
        {select("age", C.age, C.anyAge, AGE_BANDS, (o) => o)}
        {select("status", C.status, C.anyStatus, PLAYER_STATUSES, (o) => C.statuses[o as PlayerStatus])}
        {select("reports", C.reports, C.anyReports, REPORT_FILTERS, (o) => C.reportOptions[o as keyof typeof C.reportOptions])}
        {select("test", C.test, null, TEST_FILTERS, (o) => C.testOptions[o as keyof typeof C.testOptions])}
        {dateRange("joinedFrom", "joinedTo", C.joined)}
        {dateRange("activeFrom", "activeTo", C.lastActive)}
        {filtered && (
          <Btn
            size="lg"
            tone="ghost"
            icon="x"
            onClick={() =>
              setFilters(Object.fromEntries(Object.keys(PLAYER_FILTERS).map((k) => [k, null])) as Record<PlayerFilterKey, null>)
            }
          >
            {C.clear}
          </Btn>
        )}
      </div>
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {notice && (
          <Notice tone="ok" icon="check-circle">
            {notice}
          </Notice>
        )}
        {exportError && <Notice tone="danger">{exportError}</Notice>}
      </div>
      {selectable && selected.size > 0 && (
        <div
          className="bg-surface-raised flex flex-wrap items-center gap-2 rounded-[12px] px-3 py-2"
          role="region"
          aria-label={C.selected(selected.size)}
        >
          <span className="num text-[14px] font-semibold">{C.selected(selected.size)}</span>
          {canModerate && (
            <>
              <Btn tone="danger" icon="prohibit" onClick={() => (run.reset(), setBulk("ban"))}>
                {C.bulkBan}
              </Btn>
              <Btn icon="flag" onClick={() => (run.reset(), setBulk("revoke_ranking"))}>
                {C.bulkRevoke}
              </Btn>
            </>
          )}
          {canExport && (
            <Btn icon="download-simple" disabled={exporting} onClick={() => void exportCsv([...selected])}>
              {C.exportSelected}
            </Btn>
          )}
          <Btn tone="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            {C.clearSelection}
          </Btn>
        </div>
      )}
      <div className="bg-surface overflow-x-auto rounded-[12px]">
        {q.isPending ? (
          <RowsSkeleton />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {errorText(q.error)}
            </Notice>
          </div>
        ) : !rows.length ? (
          <Empty icon="users">{C.empty}</Empty>
        ) : (
          <table className="w-full min-w-[1180px] border-collapse text-[14px]">
            <SortHead cols={cols} sort={sort} />
            <tbody>
              {rows.map((r) => {
                const on = selected.has(r.id);
                return (
                  <tr key={r.id} className={`border-line border-t ${on ? "bg-[var(--success-tint)]" : "hover:bg-surface-raised/50"}`}>
                    {selectable && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={C.selectRow(r.nickname)}
                          checked={on}
                          onChange={() => toggle(r.id)}
                          className="size-5 accent-[var(--accent)]"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/players/${r.id}${here ? `?${new URLSearchParams({ list: here })}` : ""}`}
                        className="flex min-h-11 items-center font-semibold hover:underline"
                      >
                        {r.nickname}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={r.account_type === "guest" ? "neutral" : "ok"}>{C.accounts[r.account_type]}</Pill>
                    </td>
                    <td className="num text-muted max-w-[220px] truncate px-3 py-2 text-[13px]" title={r.email ?? undefined}>
                      {r.email ?? C.noEmail}
                    </td>
                    <td className="num px-3 py-2 text-[13px]">{r.age_band}</td>
                    <td className="num px-3 py-2 text-[13px] whitespace-nowrap">{C.level(r.level, fmt(r.xp))}</td>
                    <td className="num px-3 py-2 text-[13px]">{fmt(r.sparks)}</td>
                    <td className="num px-3 py-2 text-[13px]">{r.streak}</td>
                    <td className="num px-3 py-2 text-[13px]">
                      {r.reports_open ? <span className="text-danger font-semibold">{r.reports_open}</span> : r.reports_total || 0}
                    </td>
                    <td className="num text-muted px-3 py-2 text-[13px] whitespace-nowrap">
                      {r.last_active ? C.ago(age(r.last_active)) : C.never}
                    </td>
                    <td className="num text-muted px-3 py-2 text-[13px] whitespace-nowrap">{r.created_at.slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {playerStatuses(r).map((s) => (
                          <Pill key={s} tone={STATUS_TONE[s]}>
                            {C.statuses[s]}
                          </Pill>
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
      {bulk && (
        <ConfirmDialog
          open
          title={C.bulkTitle(bulk === "ban" ? C.actionLabels.ban : C.actionLabels.revoke_ranking, selected.size)}
          help={C.actionHelp[bulk]}
          confirmLabel={bulk === "ban" ? C.bulkBan : C.bulkRevoke}
          danger={bulk === "ban"}
          busy={run.isPending}
          error={run.error ? errorText(run.error) : null}
          onCancel={() => setBulk(null)}
          onConfirm={({ reason }) =>
            run.mutate(
              { action: bulk, ids: [...selected], reason, ...(bulk === "ban" && { days: days ? Number(days) : null }) },
              {
                onSuccess: (r) => {
                  setBulk(null);
                  setSelected(new Set());
                  setNotice(C.bulkDone(r.done, r.missing.length));
                },
              },
            )
          }
        >
          {bulk === "ban" && <DaysField value={days} onChange={setDays} />}
        </ConfirmDialog>
      )}
    </div>
  );
}

export function DaysField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label={C.days} htmlFor="ban-days">
      <select id="ban-days" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-11`}>
        {Object.entries(C.dayOptions).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}
