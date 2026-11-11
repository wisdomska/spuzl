"use client";

/**
 * R4-02 admin cascade: messages from the /contact feedback form, newest first. Each card leads with the message,
 * then who sent it and how to reply; the page path and device fold under Technical details. Filters (status, kind)
 * live in the address bar; the marks and the CSV download go through audited POSTs. Emails arrive masked from the
 * server unless the role holds players.pii.
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
import { exactTime } from "@/lib/admin/people-format";
import { PageHead, TechDetails, TechRow, When } from "./people-ui";
import { Btn, Empty, Field, Notice, Pill, RowsSkeleton, type PillTone } from "./ui";
import { Select } from "@/components/ui/Select";

const C = adminCopy.feedback;
const FILTERS = { status: "", kind: "" } as const;
const ALLOWED = { status: ["", ...FEEDBACK_STATUSES], kind: ["", ...FEEDBACK_KINDS] };
const TONE: Record<FeedbackStatus, PillTone> = { new: "warn", read: "neutral", done: "ok" };

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

  const filtered = !!(f.status || f.kind);
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
        <Field label={C.status} htmlFor="fb-status">
          <Select
            id="fb-status"
            value={f.status}
            onValueChange={(v) => setFilters({ status: v })}
            options={[{ value: "", label: C.anyStatus }, ...FEEDBACK_STATUSES.map((s) => ({ value: s, label: C.statuses[s] }))]}
            className="h-11 w-40"
          />
        </Field>
        <Field label={C.kind} htmlFor="fb-kind">
          <Select
            id="fb-kind"
            value={f.kind}
            onValueChange={(v) => setFilters({ kind: v })}
            options={[{ value: "", label: C.anyKind }, ...FEEDBACK_KINDS.map((k) => ({ value: k, label: C.kinds[k] }))]}
            className="h-11 w-52"
          />
        </Field>
        {filtered && (
          <Btn size="lg" tone="ghost" icon="x" onClick={() => setFilters({ status: null, kind: null })}>
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
      {q.isPending ? (
        <RowsSkeleton rows={4} height={120} />
      ) : q.error ? (
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      ) : !q.data?.rows.length ? (
        <div className="bg-surface rounded-[16px]">
          <Empty icon="chat-circle-text">{filtered ? C.emptyFiltered : C.empty}</Empty>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={C.title}>
          {q.data.rows.map((r) => {
            const when = exactTime(r.created_at);
            const pending = mark.isPending && mark.variables?.id === r.id;
            const who = r.nickname ?? C.signedOut;
            return (
              <li
                key={r.id}
                className={`bg-surface flex flex-col gap-3 rounded-[16px] p-4 sm:p-5 ${r.status === "new" ? "shadow-[inset_3px_0_0_var(--gold)]" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Pill tone={TONE[r.status]}>{C.statuses[r.status]}</Pill>
                  <Pill>{C.kinds[r.kind]}</Pill>
                  <When iso={r.created_at} className="text-muted" />
                </div>
                <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{r.message}</p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
                  <div className="flex min-w-0 flex-col">
                    <dt className="text-muted font-semibold">{C.player}</dt>
                    <dd className="truncate">
                      {r.player_id && canOpenPlayers ? (
                        <Link
                          href={`/admin/players/${r.player_id}`}
                          className="text-text inline-flex min-h-6 items-center underline underline-offset-2"
                        >
                          {who}
                        </Link>
                      ) : (
                        who
                      )}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <dt className="text-muted font-semibold">{C.age}</dt>
                    <dd>{r.age_band ? (adminCopy.players.ageBands[r.age_band] ?? r.age_band) : C.ageUnknown}</dd>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <dt className="text-muted font-semibold">{C.email}</dt>
                    <dd className="truncate">
                      {r.email ? (
                        r.emailVisible ? (
                          <a href={`mailto:${r.email}`} className="text-text underline underline-offset-2" title={C.reply}>
                            {r.email}
                          </a>
                        ) : (
                          <span>
                            {r.email} <span className="text-muted text-[12px]">({C.masked})</span>
                          </span>
                        )
                      ) : (
                        <span className="text-muted">{C.noEmail}</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {(r.from_path || r.user_agent) && (
                  <TechDetails>
                    {r.from_path && <TechRow k={C.tech.page} v={r.from_path} />}
                    {r.user_agent && <TechRow k={C.tech.device} v={r.user_agent} />}
                    <TechRow k={C.tech.id} v={r.id} />
                  </TechDetails>
                )}
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    {r.emailVisible && r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="bg-accent text-on-accent inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold hover:brightness-110"
                      >
                        {C.reply}
                      </a>
                    )}
                    {r.status === "new" && (
                      <Btn icon="eye" disabled={pending} onClick={() => act(r.id, "read")} aria-label={C.markAria(C.markRead, when)}>
                        {pending ? C.saving : C.markRead}
                      </Btn>
                    )}
                    {r.status !== "done" && (
                      <Btn icon="check" disabled={pending} onClick={() => act(r.id, "done")} aria-label={C.markAria(C.markDone, when)}>
                        {pending ? C.saving : C.markDone}
                      </Btn>
                    )}
                    {r.status !== "new" && (
                      <Btn
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
