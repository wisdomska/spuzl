"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { age, clock } from "@/lib/admin/dates";
import { ACTION_PERMISSION, SPARKS_LIMIT, playerStatuses, type PlayerAction } from "@/lib/admin/player-filters";
import type { PlayerDetail as Detail } from "@/lib/admin/players";
import { can, type Role } from "@/lib/admin/roles";
import { GAME_BY_ID } from "@/lib/catalog";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { LEAGUE_TIERS } from "@/lib/rewards";
import { ConfirmDialog } from "./ConfirmDialog";
import { DaysField, STATUS_TONE } from "./PlayersPage";
import { Btn, Empty, Field, Notice, PageTitle, Pill, ReadField, RowsSkeleton, inputCls, type PillTone } from "./ui";

const C = adminCopy.players;
const fmt = (n: number) => n.toLocaleString("en-US");
const when = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : C.never);

/** Actions in panel order; the irreversible one last. */
const ORDER: PlayerAction[] = [
  "reset_nickname",
  "sparks",
  "freeze",
  "ban",
  "unban",
  "revoke_ranking",
  "restore_ranking",
  "signout",
  "delete",
];
const DANGER = new Set<PlayerAction>(["ban", "revoke_ranking", "signout", "delete"]);
const ATTEMPT_TONE: Record<string, PillTone> = {
  cleared: "ok",
  flagged: "danger",
  failed: "neutral",
  abandoned: "neutral",
  in_progress: "warn",
};
const REPORT_TONE: Record<string, PillTone> = { open: "danger", actioned: "ok", dismissed: "neutral" };

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="bg-surface flex min-w-0 flex-col gap-2.5 rounded-[12px] p-4">
      <h2 id={id} className="font-display text-[16px] font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="bg-bg flex flex-col gap-0.5 rounded-[10px] p-2.5">
      <span className="num text-[18px] font-semibold">{value}</span>
      <span className="text-muted text-[12px] font-medium">{label}</span>
    </div>
  );
}

function MiniTable({ head, children, min = 480 }: { head: readonly string[]; children: ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: min }}>
        <thead>
          <tr className="num text-muted text-left text-[12px]">
            {head.map((h) => (
              <th key={h} scope="col" className="px-2 py-1.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const td = "border-line border-t px-2 py-1.5 align-top";

/**
 * One player (owner request): profile, account and linked sign-ins, stats, recent attempts, reports, moderation
 * history, league, inventory, Sparks ledger and audit trail, with the actions the role may take. Every action opens a
 * dialog that needs a reason; deleting also needs the nickname typed. The server checks all of it again.
 */
export function PlayerDetail({ id, role, backHref }: { id: string; role: Role; backHref: string }) {
  const router = useRouter();
  const q = useAdminQuery<Detail>(["player", id], `/api/admin/players/${id}/detail`);
  const act = useAdminAction<Record<string, unknown>, Record<string, unknown>>("POST", `/api/admin/players/${id}/actions`);
  const [open, setOpen] = useState<PlayerAction | null>(null);
  const [amount, setAmount] = useState("100");
  const [days, setDays] = useState("7");
  const [done, setDone] = useState<string | null>(null);

  if (q.isPending) return <RowsSkeleton rows={10} height={56} />;
  if (q.error)
    return (
      <div className="flex flex-col gap-3 p-6">
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
        <Link href={backHref} className="text-accent text-[14px] font-semibold hover:underline">
          {C.back}
        </Link>
      </div>
    );
  const d = q.data;
  const p = d.profile;
  const statuses = playerStatuses({ ...p, flagged: d.stats.flagged });
  const actions = ORDER.filter((a) => can(role, ACTION_PERMISSION[a])).filter((a) => {
    if (a === "unban") return !!p.banned_at;
    if (a === "ban") return !p.banned_at;
    if (a === "revoke_ranking") return !p.ranking_revoked;
    if (a === "restore_ranking") return p.ranking_revoked;
    if (a === "signout" || a === "delete") return !d.account.isAdmin;
    return true;
  });
  const amountN = Number(amount);
  const amountOk = Number.isInteger(amountN) && amountN !== 0 && Math.abs(amountN) <= SPARKS_LIMIT;

  const confirm = ({ reason, confirm }: { reason: string; confirm: string }) => {
    if (!open) return;
    const input: Record<string, unknown> = { action: open, reason };
    if (open === "sparks") input.amount = amountN;
    if (open === "ban") input.days = days ? Number(days) : null;
    if (open === "delete") input.confirm = confirm;
    const action = open;
    act.mutate(input, {
      onSuccess: (r) => {
        setOpen(null);
        if (action === "delete") {
          router.replace(backHref);
          return;
        }
        setDone(
          action === "reset_nickname"
            ? C.done.reset_nickname(String(r.nickname))
            : action === "sparks"
              ? C.done.sparks(Number(r.after))
              : action === "freeze"
                ? C.done.freeze(Number(r.freezes))
                : action === "signout"
                  ? C.done.signout(Number(r.sessions))
                  : C.done[action],
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6">
      <Link href={backHref} className="text-muted hover:text-text flex h-11 items-center gap-1.5 self-start text-[13px] font-semibold">
        <Icon name="arrow-left" size={16} />
        {C.back}
      </Link>
      <PageTitle title={p.nickname}>
        <span className="flex flex-wrap gap-1">
          <Pill tone={d.account.type === "guest" ? "neutral" : "ok"}>{C.accounts[d.account.type]}</Pill>
          {statuses.map((s) => (
            <Pill key={s} tone={STATUS_TONE[s]}>
              {C.statuses[s]}
            </Pill>
          ))}
        </span>
      </PageTitle>
      <div aria-live="polite" className="empty:hidden">
        {done && (
          <Notice tone="ok" icon="check-circle">
            {done}
          </Notice>
        )}
      </div>
      {p.banned_at && (
        <Notice tone="danger" icon="prohibit">
          {C.banned(p.banned_until ? p.banned_until.slice(0, 10) : null)} {p.ban_reason ? C.banReason(p.ban_reason) : ""}
        </Notice>
      )}
      {p.ranking_revoked && <Notice tone="warn">{C.revoked}</Notice>}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <Section title={C.profile} id="pd-profile">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ReadField label={C.playerId} value={<span className="num truncate text-[13px]">{p.id}</span>} />
              <ReadField label={C.ageBand} value={p.age_band} />
              <ReadField label={C.joinedOn} value={when(p.created_at)} />
              <ReadField label={C.lastSeen} value={p.last_seen_at ? C.ago(age(p.last_seen_at)) : C.never} />
            </div>
          </Section>

          <Section title={C.stats} id="pd-stats">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat value={p.level} label={C.statLabels.level} />
              <Stat value={fmt(p.xp)} label={C.statLabels.xp} />
              <Stat value={fmt(p.sparks)} label={C.statLabels.sparks} />
              <Stat value={d.stats.streak} label={C.statLabels.streak} />
              <Stat value={d.stats.bestStreak} label={C.statLabels.best} />
              <Stat value={d.stats.freezes} label={C.statLabels.freezes} />
              <Stat value={fmt(d.stats.attempts)} label={C.statLabels.attempts} />
              <Stat value={fmt(d.stats.clears)} label={C.statLabels.clears} />
              <Stat value={fmt(d.stats.dailyClears)} label={C.statLabels.daily} />
              <Stat value={d.stats.flagged} label={C.statLabels.flagged} />
              <Stat value={d.stats.badges} label={C.statLabels.badges} />
            </div>
          </Section>

          <Section title={C.recent} id="pd-attempts">
            {!d.attempts.length ? (
              <Empty icon="puzzle-piece">{C.noAttempts}</Empty>
            ) : (
              <MiniTable head={C.recentHead}>
                {d.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} font-semibold`}>{GAME_BY_ID[a.game_id]?.name ?? a.game_id}</td>
                    <td className={`${td} text-muted`}>{a.mode}</td>
                    <td className={`${td} num`}>{a.time_ms !== null ? clock(a.time_ms) : C.noEmail}</td>
                    <td className={td}>
                      <Pill tone={ATTEMPT_TONE[a.status] ?? "neutral"}>{adminCopy.common.statusLabel(a.status)}</Pill>
                    </td>
                    <td className={`${td} num text-muted`}>{C.ago(age(a.started_at))}</td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </Section>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {(
              [
                ["pd-rr", C.reportsReceived, d.reportsReceived],
                ["pd-rm", C.reportsMade, d.reportsMade],
              ] as const
            ).map(([sid, title, list]) => (
              <Section key={sid} title={title} id={sid}>
                {!list.length ? (
                  <p className="text-muted text-[13px]">{C.noReports}</p>
                ) : (
                  <MiniTable head={C.reportsHead} min={360}>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td className={`${td} num text-muted`}>{r.ref}</td>
                        <td className={td}>{r.reason}</td>
                        <td className={`${td} text-muted`}>{r.target_type}</td>
                        <td className={td}>
                          <Pill tone={REPORT_TONE[r.status] ?? "neutral"}>{r.status}</Pill>
                        </td>
                        <td className={`${td} num text-muted`}>{age(r.created_at)}</td>
                      </tr>
                    ))}
                  </MiniTable>
                )}
              </Section>
            ))}
          </div>

          <Section title={C.moderation} id="pd-mod">
            {!d.moderation.length ? <p className="text-muted text-[13px]">{C.noModeration}</p> : <AuditTable rows={d.moderation} />}
          </Section>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Section title={C.league} id="pd-league">
              {!d.league.length ? (
                <p className="text-muted text-[13px]">{C.noLeague}</p>
              ) : (
                <MiniTable head={C.leagueHead} min={340}>
                  {d.league.map((l) => (
                    <tr key={l.week_start}>
                      <td className={`${td} num`}>{l.week_start}</td>
                      <td className={td}>{LEAGUE_TIERS[l.tier] ?? l.tier}</td>
                      <td className={`${td} num`}>{fmt(l.points)}</td>
                      <td className={`${td} num`}>{l.rank ?? C.noEmail}</td>
                      <td className={`${td} text-muted`}>{l.result ?? C.noEmail}</td>
                    </tr>
                  ))}
                </MiniTable>
              )}
            </Section>
            <Section title={C.sparksLedger} id="pd-ledger">
              {!d.sparks.length ? (
                <p className="text-muted text-[13px]">{C.noLedger}</p>
              ) : (
                <ul className="flex flex-col text-[13px]">
                  {d.sparks.map((s) => (
                    <li key={s.id} className="border-line flex items-center gap-2 border-t py-1.5 first:border-t-0">
                      <span className={`num w-16 font-semibold ${s.amount < 0 ? "text-danger" : "text-accent"}`}>
                        {s.amount > 0 ? "+" : ""}
                        {fmt(s.amount)}
                      </span>
                      <span className="flex-1 truncate">{s.source.replace(/_/g, " ")}</span>
                      <span className="num text-muted">{age(s.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title={C.inventory} id="pd-inv">
            {!d.inventory.length ? (
              <p className="text-muted text-[13px]">{C.noInventory}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {d.inventory.map((i) => (
                  <li key={i.id}>
                    <Pill tone={i.equipped ? "ok" : "neutral"}>
                      {i.name}
                      {i.type ? ` · ${i.type.replace(/_/g, " ")}` : ""}
                      {i.equipped ? ` · ${C.equipped}` : ""}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={C.audit} id="pd-audit">
            {!d.audit.length ? <p className="text-muted text-[13px]">{C.noAudit}</p> : <AuditTable rows={d.audit} />}
          </Section>
        </div>

        <div className="flex flex-col gap-3.5">
          <Section title={C.accountTitle} id="pd-account">
            <ReadField label={C.head.account} value={C.accounts[d.account.type]} />
            <ReadField label={C.head.email} value={<span className="num truncate text-[13px]">{d.account.email ?? C.noEmail}</span>} />
            {!d.account.emailVisible && d.account.email && <p className="text-muted text-[12px]">{C.emailMasked}</p>}
            <ReadField label={C.signedInLast} value={d.account.lastSignInAt ? C.ago(age(d.account.lastSignInAt)) : C.never} />
            <div className="flex flex-col gap-1">
              <span className="num text-muted text-[12px] font-semibold">{C.identities}</span>
              {!d.account.identities.length ? (
                <span className="text-muted text-[13px]">{C.noIdentities}</span>
              ) : (
                <ul className="flex flex-col gap-1 text-[13px]">
                  {d.account.identities.map((i) => (
                    <li key={i.provider} className="flex items-center gap-2">
                      <Pill tone="ok">{C.accounts[i.provider as keyof typeof C.accounts] ?? i.provider}</Pill>
                      <span className="num text-muted">{i.created_at ? i.created_at.slice(0, 10) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {d.account.isAdmin && <Notice icon="info">{C.adminAccount}</Notice>}
          </Section>

          <Section title={C.actions} id="pd-actions">
            {!actions.length ? (
              <p className="text-muted text-[13px]">{C.readOnly}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {actions.map((a) => (
                  <Btn
                    key={a}
                    size="lg"
                    tone={a === "delete" ? "danger" : "secondary"}
                    className="justify-start"
                    onClick={() => (act.reset(), setDone(null), setOpen(a))}
                  >
                    {C.actionLabels[a]}
                  </Btn>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {open && (
        <ConfirmDialog
          open
          title={`${C.actionLabels[open]}: ${p.nickname}`}
          help={C.actionHelp[open]}
          confirmLabel={C.actionLabels[open]}
          danger={DANGER.has(open)}
          irreversible={open === "delete"}
          typed={open === "delete" ? p.nickname : undefined}
          ready={open !== "sparks" || amountOk}
          busy={act.isPending}
          error={act.error ? errorText(act.error) : null}
          onCancel={() => setOpen(null)}
          onConfirm={confirm}
        >
          {open === "sparks" && (
            <Field label={C.amount} htmlFor="pd-amount">
              <input
                id="pd-amount"
                type="number"
                inputMode="numeric"
                step={1}
                min={-SPARKS_LIMIT}
                max={SPARKS_LIMIT}
                value={amount}
                aria-invalid={!amountOk}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputCls} num h-11`}
              />
            </Field>
          )}
          {open === "ban" && <DaysField value={days} onChange={setDays} />}
        </ConfirmDialog>
      )}
    </div>
  );
}

function AuditTable({ rows }: { rows: Detail["audit"] }) {
  return (
    <MiniTable head={C.auditHead} min={520}>
      {rows.map((a) => (
        <tr key={a.id}>
          <td className={`${td} num text-muted whitespace-nowrap`}>{when(a.created_at)}</td>
          <td className={`${td} max-w-[160px] truncate`}>{a.actor ?? C.system}</td>
          <td className={`${td} num font-semibold`}>{a.action}</td>
          <td className={`${td} num text-muted max-w-[280px] text-[12px]`}>
            <span className="line-clamp-2 break-all">{JSON.stringify(a.detail)}</span>
          </td>
        </tr>
      ))}
    </MiniTable>
  );
}
