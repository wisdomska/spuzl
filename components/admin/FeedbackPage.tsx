"use client";

/**
 * R4-02 admin cascade: messages from the /contact feedback form, newest first. Filters (status, kind) live in the
 * address bar; Mark read / Done and the CSV export go through audited POSTs. Emails arrive masked from the server
 * unless the role holds players.pii.
 */
import Link from "next/link";
import { useState } from "react";
import type { FeedbackRow } from "@/lib/admin/feedback";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback";
import { api } from "@/lib/client/api";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, usePager } from "./Pagination";
import { useUrlFilters } from "./useUrlFilters";
import { Btn, Empty, Field, Notice, PageTitle, Pill, RowsSkeleton, inputCls, type PillTone } from "./ui";

const C = adminCopy.feedback;
const FILTERS = { status: "", kind: "" } as const;
const ALLOWED = { status: ["", ...FEEDBACK_STATUSES], kind: ["", ...FEEDBACK_KINDS] };
const TONE: Record<FeedbackStatus, PillTone> = { new: "warn", read: "neutral", done: "ok" };
const minute = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

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

export function FeedbackPage({ canWrite, canOpenPlayers }: { canWrite: boolean; canOpenPlayers: boolean }) {
  const [f, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const pager = usePager();
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
  const q = useAdminQuery<AdminPage<FeedbackRow>>(
    ["feedback", qs.toString(), pager.query],
    `/api/admin/feedback?${qs}${qs.size ? "&" : ""}${pager.query}`,
    { keepPrevious: true },
  );
  const mark = useAdminAction<{ id: string; status: FeedbackStatus }>("POST", (i) => `/api/admin/feedback/${i.id}`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const exportCsv = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await api<{ filename: string; csv: string; rows: number; total: number }>("/api/admin/feedback", {
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
  const act = (id: string, status: FeedbackStatus) =>
    mark.mutate({ id, status }, { onError: (e) => setNote({ tone: "danger", text: errorText(e) }) });

  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title={C.title}
        aside={
          <Btn tone="ghost" icon="download-simple" onClick={() => void exportCsv()} disabled={busy}>
            {busy ? C.exporting : C.csv}
          </Btn>
        }
      >
        <span className="text-muted text-[14px]">{C.intro}</span>
      </PageTitle>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={C.status} htmlFor="fb-status">
          <select id="fb-status" value={f.status} onChange={(e) => setFilters({ status: e.target.value })} className={`${inputCls} w-40`}>
            <option value="">{C.anyStatus}</option>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {C.statuses[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={C.kind} htmlFor="fb-kind">
          <select id="fb-kind" value={f.kind} onChange={(e) => setFilters({ kind: e.target.value })} className={`${inputCls} w-48`}>
            <option value="">{C.anyKind}</option>
            {FEEDBACK_KINDS.map((k) => (
              <option key={k} value={k}>
                {C.kinds[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {note && (
        <Notice tone={note.tone === "ok" ? "ok" : "danger"} icon={note.tone === "ok" ? "check-circle" : "warning"}>
          {note.text}
        </Notice>
      )}
      {q.isPending ? (
        <RowsSkeleton rows={4} height={120} />
      ) : q.error ? (
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      ) : !q.data?.rows.length ? (
        <div className="bg-surface rounded-[12px]">
          <Empty icon="chat-circle-text">{C.empty}</Empty>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5" aria-label={C.title}>
          {q.data.rows.map((r) => {
            const when = minute(r.created_at);
            const pending = mark.isPending && mark.variables?.id === r.id;
            return (
              <li key={r.id} className="bg-surface flex flex-col gap-3 rounded-[12px] p-4">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Pill tone={TONE[r.status]}>{C.statuses[r.status]}</Pill>
                  <Pill>{C.kinds[r.kind]}</Pill>
                  <span className="num text-muted">{when} GMT</span>
                </div>
                <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{r.message}</p>
                <dl className="text-muted grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex min-w-0 gap-1.5">
                    <dt className="font-semibold">{C.from}</dt>
                    <dd className="num truncate">{r.from_path ?? "–"}</dd>
                  </div>
                  <div className="flex min-w-0 gap-1.5">
                    <dt className="font-semibold">{C.age}</dt>
                    <dd className="num">{r.age_band ?? "–"}</dd>
                  </div>
                  <div className="flex min-w-0 gap-1.5">
                    <dt className="font-semibold">{C.email}</dt>
                    <dd className="truncate">
                      {r.email ? (
                        r.emailVisible ? (
                          <a href={`mailto:${r.email}`} className="text-text underline underline-offset-2">
                            {r.email}
                          </a>
                        ) : (
                          <span>
                            {r.email} <span className="text-[12px]">({C.masked})</span>
                          </span>
                        )
                      ) : (
                        C.noEmail
                      )}
                    </dd>
                  </div>
                  <div className="flex min-w-0 gap-1.5">
                    <dt className="font-semibold">{C.player}</dt>
                    <dd className="truncate">
                      {r.player_id ? (
                        canOpenPlayers ? (
                          <Link href={`/admin/players/${r.player_id}`} className="text-text underline underline-offset-2">
                            {r.nickname ?? r.player_id.slice(0, 8)}
                          </Link>
                        ) : (
                          (r.nickname ?? r.player_id.slice(0, 8))
                        )
                      ) : (
                        C.signedOut
                      )}
                    </dd>
                  </div>
                  {r.user_agent && (
                    <div className="flex min-w-0 gap-1.5 sm:col-span-2 xl:col-span-4">
                      <dt className="font-semibold">{C.device}</dt>
                      <dd className="truncate" title={r.user_agent}>
                        {r.user_agent}
                      </dd>
                    </div>
                  )}
                </dl>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    {r.status === "new" && (
                      <Btn
                        size="sm"
                        icon="eye"
                        disabled={pending}
                        onClick={() => act(r.id, "read")}
                        aria-label={C.markAria(C.markRead, when)}
                      >
                        {pending ? C.saving : C.markRead}
                      </Btn>
                    )}
                    {r.status !== "done" && (
                      <Btn
                        size="sm"
                        icon="check"
                        disabled={pending}
                        onClick={() => act(r.id, "done")}
                        aria-label={C.markAria(C.markDone, when)}
                      >
                        {pending ? C.saving : C.markDone}
                      </Btn>
                    )}
                    {r.status !== "new" && (
                      <Btn
                        size="sm"
                        tone="ghost"
                        icon="arrow-counter-clockwise"
                        disabled={pending}
                        onClick={() => act(r.id, "new")}
                        aria-label={C.markAria(C.reopen, when)}
                      >
                        {C.reopen}
                      </Btn>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}
