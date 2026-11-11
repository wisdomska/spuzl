"use client";

/**
 * R2-13 admin cascade: the join-approval log for under-16 hosts' friends-only rooms. Filters live in the address
 * bar (answer, game, nickname or code, GMT days); the CSV download goes through an audited POST. Who asked comes
 * first, then the host and the answer; times read "2 hours ago" with the exact GMT time on hover.
 */
import { useState } from "react";
import { todayIso } from "@/lib/admin/dates";
import { JOIN_LOG_KINDS, type JoinLogRow } from "@/lib/admin/join-log";
import { JOIN_REQUEST_STATUSES } from "@/lib/multiplayer/joinRules";
import { api } from "@/lib/client/api";
import { errorText, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, usePager } from "./Pagination";
import { useDebouncedFilter, useUrlFilters } from "./useUrlFilters";
import { PageHead, When } from "./people-ui";
import { Btn, Empty, Field, Notice, Pill, RowsSkeleton, inputCls, type PillTone } from "./ui";

const C = adminCopy.joinLog;
const FILTERS = { status: "", kind: "", q: "", from: "", to: "" } as const;
const ALLOWED = { status: ["", ...JOIN_REQUEST_STATUSES], kind: ["", ...JOIN_LOG_KINDS] };
const TONE: Record<string, PillTone> = { pending: "warn", approved: "ok", declined: "danger", cancelled: "neutral" };
const td = "border-line border-t px-3 py-2.5 align-middle";

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

export function JoinRequestsPage() {
  const [f, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const [qText, setQText] = useDebouncedFilter(f.q, (v) => setFilters({ q: v }, { replace: true }));
  const pager = usePager();
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
  const q = useAdminQuery<AdminPage<JoinLogRow>>(
    ["join-requests", qs.toString(), pager.query],
    `/api/admin/join-requests?${qs}${qs.size ? "&" : ""}${pager.query}`,
    { keepPrevious: true },
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const exportCsv = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ filename: string; csv: string; rows: number; total: number }>("/api/admin/join-requests", {
        method: "POST",
        json: f,
      });
      save(r.filename, r.csv);
      setNote({ tone: "ok", text: C.exported(r.rows, r.total) });
    } catch (e) {
      setNote({ tone: "danger", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const filtered = Object.values(f).some(Boolean);
  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <PageHead
        title={C.title}
        purpose={C.intro}
        aside={
          <Btn icon="download-simple" title={C.csvTitle} onClick={() => void exportCsv()} disabled={busy}>
            {busy ? C.exporting : C.csv}
          </Btn>
        }
      />
      <div role="search" aria-label={C.title} className="bg-surface flex flex-wrap items-end gap-2 rounded-[16px] p-4">
        <Field label={C.search} htmlFor="jr-q">
          <input
            id="jr-q"
            type="search"
            value={qText}
            maxLength={24}
            placeholder={C.searchPlaceholder}
            onChange={(e) => setQText(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
            className={`${inputCls} h-11 w-52 max-w-full`}
          />
        </Field>
        <Field label={C.outcome} htmlFor="jr-status">
          <select
            id="jr-status"
            value={f.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className={`${inputCls} h-11 w-44`}
          >
            <option value="">{C.anyOutcome}</option>
            {JOIN_REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {C.outcomes[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={C.room} htmlFor="jr-kind">
          <select id="jr-kind" value={f.kind} onChange={(e) => setFilters({ kind: e.target.value })} className={`${inputCls} h-11 w-44`}>
            <option value="">{C.anyRoom}</option>
            {JOIN_LOG_KINDS.map((k) => (
              <option key={k} value={k}>
                {C.rooms[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={C.from} htmlFor="jr-from">
          <input
            id="jr-from"
            type="date"
            max={f.to || todayIso()}
            value={f.from}
            onChange={(e) => setFilters({ from: e.target.value }, { replace: true })}
            className={`${inputCls} h-11 w-40`}
          />
        </Field>
        <Field label={C.to} htmlFor="jr-to">
          <input
            id="jr-to"
            type="date"
            min={f.from || undefined}
            max={todayIso()}
            value={f.to}
            onChange={(e) => setFilters({ to: e.target.value }, { replace: true })}
            className={`${inputCls} h-11 w-40`}
          />
        </Field>
        {filtered && (
          <Btn size="lg" tone="ghost" icon="x" onClick={() => setFilters({ status: null, kind: null, q: null, from: null, to: null })}>
            {C.clear}
          </Btn>
        )}
      </div>
      <div aria-live="polite" className="empty:hidden">
        {note && (
          <Notice tone={note.tone === "ok" ? "ok" : "danger"} icon={note.tone === "ok" ? "check-circle" : "warning"}>
            {note.text}
          </Notice>
        )}
      </div>
      <div className="bg-surface max-h-[75dvh] overflow-auto rounded-[16px]">
        {q.isPending ? (
          <RowsSkeleton />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {errorText(q.error)}
            </Notice>
          </div>
        ) : !q.data?.rows.length ? (
          <Empty icon="hand-waving">{filtered ? C.emptyFiltered : C.empty}</Empty>
        ) : (
          <table className="w-full border-collapse text-[14px]" style={{ minWidth: 760 }}>
            <thead>
              <tr className="text-muted text-left text-[12px]">
                {C.head.map((h) => (
                  <th key={h} scope="col" className="bg-surface-raised sticky top-0 z-[1] px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-raised/50">
                  <td className={`${td} max-w-[200px] truncate font-semibold`}>
                    {r.requester ?? <span className="text-muted font-normal">{C.gone}</span>}
                  </td>
                  <td className={`${td} max-w-[200px] truncate`}>{r.host ?? <span className="text-muted">{C.gone}</span>}</td>
                  <td className={`${td} text-[13px] whitespace-nowrap`}>
                    {C.rooms[r.room_kind]}{" "}
                    <span className="num text-muted" title={C.tech.room}>
                      {r.room_code}
                    </span>
                  </td>
                  <td className={td}>
                    <Pill tone={TONE[r.status]}>{C.outcomes[r.status]}</Pill>
                  </td>
                  <td className={`${td} text-muted text-[13px] whitespace-nowrap`}>
                    <When iso={r.created_at} />
                  </td>
                  <td className={`${td} text-muted text-[13px] whitespace-nowrap`}>
                    <When iso={r.decided_at} fallback={C.notYet} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}
