"use client";

import { useState, type ReactNode } from "react";
import { age, clock } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { Btn, Empty, Notice, PageTitle, Pill, RowsSkeleton, Tabs, type PillTone } from "./ui";

type Tab = "reports" | "nicknames" | "flagged";
interface Row {
  id: string;
  ref: string;
  title: string;
  kind: string;
  status: string;
  created_at: string;
  player_id: string | null;
}
interface Queue {
  rows: Row[];
  counts: Record<Tab, number>;
  open: number;
}
interface Player {
  id: string;
  nickname: string;
  created_at: string;
  banned_at: string | null;
  banned_until: string | null;
  ranking_revoked: boolean;
  reports: number;
  flagged: number;
}

const STATUS_TONE: Record<string, PillTone> = { open: "danger", flagged: "danger", actioned: "ok", dismissed: "neutral" };

/** Moderation queue (design: Admin moderation): reports, nickname reports and flagged scores, with a case panel. */
export function ModerationQueue({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>("reports");
  const [status, setStatus] = useState("open");
  const [sel, setSel] = useState<string | null>(null);
  const q = useAdminQuery<Queue>(["moderation", tab, status], `/api/admin/moderation?tab=${tab}&status=${tab === "flagged" ? "open" : status}`);
  const selected = q.data?.rows.find((r) => r.id === sel) ?? q.data?.rows[0] ?? null;

  return (
    <div className="grid min-h-dvh grid-cols-1 xl:grid-cols-[1fr_440px]">
      <div className="flex min-w-0 flex-col gap-3 px-6 py-5">
        <PageTitle
          title="Moderation queue"
          aside={
            <Tabs<Tab>
              label="Queue"
              value={tab}
              onChange={(t) => (setTab(t), setSel(null))}
              items={[
                { id: "reports", label: "Reports" },
                { id: "nicknames", label: "Nicknames" },
                { id: "flagged", label: "Anti-cheat" },
              ]}
            />
          }
        >
          {q.data && <Pill tone={q.data.open ? "danger" : "ok"}>{q.data.open} open</Pill>}
        </PageTitle>
        {tab !== "flagged" && (
          <label className="text-muted flex items-center gap-2 self-start text-[13px] font-semibold">
            Showing
            <select value={status} onChange={(e) => (setStatus(e.target.value), setSel(null))} style={{ fontSize: 13 }} className="bg-surface text-text h-9 rounded-[10px] px-2 font-semibold">
              <option value="open">Open</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All</option>
            </select>
          </label>
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
          ) : !q.data.rows.length ? (
            <Empty>Nothing waiting here.</Empty>
          ) : (
            <table className="w-full min-w-[620px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[90px]" />
                <col />
                <col className="w-[140px]" />
                <col className="w-[110px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead>
                <tr className="bg-surface-raised">
                  {["ID", "Report", "Kind", "Status", "Age"].map((h) => (
                    <th key={h} scope="col" className="num text-muted px-3 py-2.5 text-left text-[12px] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((r) => {
                  const on = selected?.id === r.id;
                  return (
                    <tr key={r.id} className={`border-line cursor-pointer border-t ${on ? "bg-[var(--success-tint)]" : "hover:bg-surface-raised/50"}`} onClick={() => setSel(r.id)}>
                      <td className="num text-muted px-3 py-2.5 align-top text-[13px] font-semibold">{r.ref}</td>
                      <td className="px-3 py-2.5 align-top text-[14px] font-medium">
                        <button type="button" aria-pressed={on} onClick={() => setSel(r.id)} className="text-left hover:underline">
                          {r.title}
                        </button>
                      </td>
                      <td className="text-muted px-3 py-2.5 align-top text-[13px] font-medium">{r.kind}</td>
                      <td className="px-3 py-2.5 align-top">
                        <Pill tone={STATUS_TONE[r.status] ?? "warn"}>{r.status}</Pill>
                      </td>
                      <td className="num text-muted px-3 py-2.5 align-top text-[13px]">{age(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <aside aria-label="Case" className="bg-surface border-line flex min-h-[400px] flex-col gap-3 border-t p-5 xl:border-t-0 xl:border-l">
        {!selected ? (
          <Empty icon="shield-check">Pick a case to review.</Empty>
        ) : tab === "flagged" ? (
          <FlaggedCase key={selected.id} id={selected.id} canWrite={canWrite} />
        ) : (
          <ReportCase key={selected.id} id={selected.id} nickname={tab === "nicknames"} canWrite={canWrite} />
        )}
      </aside>
    </div>
  );
}

function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: "danger" | "gold" }) {
  return (
    <div className="bg-bg flex flex-col gap-0.5 rounded-[10px] p-2.5">
      <span className={`num text-[18px] font-semibold ${tone === "danger" ? "text-danger" : tone === "gold" ? "text-gold" : ""}`}>{value}</span>
      <span className="text-muted text-[12px] font-medium">{label}</span>
    </div>
  );
}

const accountAge = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return { text: d < 1 ? "today" : d === 1 ? "1 day" : `${d} days`, young: d < 7 };
};

function FlaggedCase({ id, canWrite }: { id: string; canWrite: boolean }) {
  const q = useAdminQuery<{
    attempt: { ref: string; time_ms: number; flag_reason: string | null; daily_date: string | null; dailyNumber: number | null; hints: number; mistakes: number; mode: string };
    game: { name: string; minTimeMs: number | null };
    player: Player | null;
    bestMs: number | null;
    wallMs: number | null;
    gaps: number[];
  }>(["flagged", id], `/api/admin/moderation/flagged/${id}`);
  const act = useAdminAction<{ decision: "clear" | "reject"; note?: string; ban?: { days: number | null } }>("POST", `/api/admin/moderation/flagged/${id}`);
  if (q.isPending) return <RowsSkeleton rows={5} height={56} />;
  if (q.error) return <Notice tone="danger">{errorText(q.error)}</Notice>;
  const { attempt: a, player, gaps } = q.data;
  const acc = player ? accountAge(player.created_at) : null;
  const max = Math.max(1, ...gaps);
  const median = gaps.length ? [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length / 2)] : null;
  return (
    <>
      <h2 className="font-display text-[16px] font-extrabold">
        {a.ref} · {player?.nickname ?? "player"}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Stat value={clock(a.time_ms)} label="claimed time" tone="danger" />
        <Stat value={q.data.bestMs ? clock(q.data.bestMs) : "none"} label={a.daily_date ? "fastest verified that day" : "fastest verified"} />
        <Stat value={acc?.text ?? "?"} label="account age" tone={acc?.young ? "gold" : undefined} />
        <Stat value={player?.reports ?? 0} label="reports" />
      </div>
      <div className="bg-bg flex flex-col gap-1.5 rounded-[10px] p-3">
        <span className="num text-muted text-[12px] font-semibold">
          Solve trace, {q.data.game.name}
          {a.dailyNumber ? ` #${a.dailyNumber}` : ` (${a.mode})`}
        </span>
        {gaps.length ? (
          <div className="flex h-[60px] items-end gap-0.5" role="img" aria-label={`${gaps.length} inputs, median gap ${median} ms`}>
            {gaps.slice(-40).map((g, i) => (
              <span key={i} className="flex-1 rounded-[2px]" style={{ height: `${Math.max(8, (g / max) * 100)}%`, background: g < 250 ? "var(--danger)" : "var(--admin-bar)" }} />
            ))}
          </div>
        ) : (
          <span className="text-muted text-[13px]">No timed move log was stored for this attempt.</span>
        )}
        <span className="text-danger text-[12px] font-medium">
          {a.flag_reason ?? "Flagged"}
          {median !== null ? `. Median input gap ${median} ms.` : "."}
          {q.data.game.minTimeMs ? ` Human floor ${clock(q.data.game.minTimeMs)}.` : ""}
          {q.data.wallMs !== null ? ` Server wall time ${clock(q.data.wallMs)}.` : ""}
        </span>
      </div>
      {act.error && <Notice tone="danger">{errorText(act.error)}</Notice>}
      {act.isSuccess && <Notice tone="ok" icon="check-circle">Resolved.</Notice>}
      {canWrite && !act.isSuccess && (
        <div className="mt-auto flex flex-col gap-2">
          <Btn size="lg" tone="danger" disabled={act.isPending} onClick={() => act.mutate({ decision: "reject", note: "Void times + 7-day ban", ban: { days: 7 } })}>
            Void times + 7-day ban
          </Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn size="lg" disabled={act.isPending} onClick={() => act.mutate({ decision: "clear", note: "Cleared by moderator" })}>
              Clear to boards
            </Btn>
            <Btn size="lg" disabled={act.isPending} onClick={() => act.mutate({ decision: "reject", note: "Rejected" })}>
              Reject
            </Btn>
          </div>
        </div>
      )}
    </>
  );
}

function ReportCase({ id, nickname, canWrite }: { id: string; nickname: boolean; canWrite: boolean }) {
  const q = useAdminQuery<{
    report: { ref: string; reason: string; status: string; target_type: string; target_id: string; created_at: string; resolution: string | null };
    target: Player | null;
    reporter: { nickname: string } | null;
    related: { ref: string; reason: string; status: string; created_at: string }[];
  }>(["report", id], `/api/admin/moderation/reports/${id}`);
  const decide = useAdminAction<{ decision: "dismiss" | "actioned" | "reopen"; note?: string }>("POST", `/api/admin/moderation/reports/${id}`);
  const player = useAdminAction<{ action: string; days?: number | null; reason?: string; nickname?: string; pid: string }, { nickname: string | null }>(
    "POST",
    (i) => `/api/admin/players/${i.pid}`,
  );
  const [rename, setRename] = useState("");
  if (q.isPending) return <RowsSkeleton rows={5} height={56} />;
  if (q.error) return <Notice tone="danger">{errorText(q.error)}</Notice>;
  const { report: r, target: t } = q.data;
  const acc = t ? accountAge(t.created_at) : null;
  const run = async (action: string, extra: { days?: number | null; reason?: string; nickname?: string } = {}, close: "actioned" | null = "actioned") => {
    if (!t) return;
    await player.mutateAsync({ pid: t.id, action, ...extra });
    if (close) await decide.mutateAsync({ decision: close, note: action });
  };
  const err = decide.error ?? player.error;
  return (
    <>
      <h2 className="font-display text-[16px] font-extrabold">
        {r.ref} · {t?.nickname ?? r.target_type}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Stat value={r.reason} label="reason" tone="danger" />
        <Stat value={t ? t.reports : q.data.related.length + 1} label="reports on target" />
        <Stat value={acc?.text ?? "n/a"} label="account age" tone={acc?.young ? "gold" : undefined} />
        <Stat value={t ? t.flagged : 0} label="flagged scores" />
      </div>
      <div className="bg-bg flex flex-col gap-1 rounded-[10px] p-3 text-[13px]">
        <span className="num text-muted text-[12px] font-semibold">Case</span>
        <span>
          Reported by {q.data.reporter?.nickname ?? "a player"} {age(r.created_at)} ago. Status <b>{r.status}</b>
          {r.resolution ? `, ${r.resolution}` : ""}.
        </span>
        {t?.banned_at && <span className="text-danger font-semibold">Banned{t.banned_until ? ` until ${t.banned_until.slice(0, 10)}` : ""}.</span>}
        {t?.ranking_revoked && <span className="text-gold font-semibold">Ranking revoked.</span>}
        {q.data.related.length > 0 && <span className="text-muted">Also: {q.data.related.map((x) => `${x.ref} ${x.reason}`).join(", ")}</span>}
      </div>
      {err && <Notice tone="danger">{errorText(err)}</Notice>}
      {player.data?.nickname && (
        <Notice tone="ok" icon="check-circle">
          Renamed to {player.data.nickname}.
        </Notice>
      )}
      {canWrite && t && nickname && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("rename", { nickname: rename || undefined });
          }}
        >
          <label htmlFor="rename" className="sr-only">
            New nickname
          </label>
          <input id="rename" value={rename} onChange={(e) => setRename(e.target.value)} placeholder="New nickname (blank: Spuzler1234)" className="bg-bg h-11 min-w-0 flex-1 rounded-[12px] px-3 text-[14px] shadow-[inset_0_0_0_1px_var(--line)]" />
          <Btn type="submit" size="lg" disabled={player.isPending}>
            Rename
          </Btn>
        </form>
      )}
      {canWrite && (
        <div className="mt-auto flex flex-col gap-2">
          {t && (
            <Btn size="lg" tone="danger" disabled={player.isPending} onClick={() => run(nickname ? "ban" : "ban_void", { days: 7, reason: `Report ${r.ref}: ${r.reason}` })}>
              {nickname ? "Ban 7 days" : "Void times + 7-day ban"}
            </Btn>
          )}
          {t && (
            <div className="grid grid-cols-3 gap-2">
              <Btn disabled={player.isPending} onClick={() => run(t.ranking_revoked ? "restore_ranking" : "revoke_ranking", {}, null)}>
                {t.ranking_revoked ? "Restore ranking" : "Revoke ranking"}
              </Btn>
              <Btn disabled={player.isPending} onClick={() => run("reset", {}, null)}>
                Reset times
              </Btn>
              <Btn disabled={player.isPending || !t.banned_at} onClick={() => run("unban", {}, null)}>
                Unban
              </Btn>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {r.status === "open" ? (
              <>
                <Btn size="lg" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "actioned", note: "Handled" })}>
                  Mark actioned
                </Btn>
                <Btn size="lg" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "dismiss", note: "No action" })}>
                  Dismiss
                </Btn>
              </>
            ) : (
              <Btn size="lg" icon="arrow-counter-clockwise" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "reopen" })}>
                Reopen
              </Btn>
            )}
          </div>
        </div>
      )}
    </>
  );
}
