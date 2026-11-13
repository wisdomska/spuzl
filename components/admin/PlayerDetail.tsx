"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ACTION_PERMISSION, SPARKS_LIMIT, playerStatuses, type PlayerAction } from "@/lib/admin/player-filters";
import { activityOf, dayDate, exactTime, timeAgo, timeUntil } from "@/lib/admin/people-format";
import type { PlayerDetail as Detail } from "@/lib/admin/players";
import { can, type Role } from "@/lib/admin/roles";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { LEAGUE_TIERS } from "@/lib/rewards";
import { ConfirmDialog } from "./ConfirmDialog";
import { MIN_AGE, ageBandOf, birthProblem, birthYears } from "@/lib/age";
import { ageCopy } from "@/lib/copy/age";
import { DaysField, STATUS_TONE } from "./PlayersPage";
import { Card, Fact, Figure, TechDetails, When } from "./people-ui";
import { Btn, Field, Notice, Pill, RowsSkeleton, Tabs, inputCls, type PillTone } from "./ui";
import { Paged } from "./Pagination";
import { PlayerGamesTable } from "./PlayerGamesTable";
import { allGames } from "@/lib/admin/player-games";
import { Select } from "@/components/ui/Select";

const C = adminCopy.players;
const fmt = (n: number) => n.toLocaleString("en-US");
const band = (b: string | null | undefined) => (b ? (C.ageBands[b] ?? b) : "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Actions grouped the way a person thinks about them; within a group, the gentlest first and the irreversible last. */
const GROUPS: { id: keyof typeof C.actionGroups; actions: PlayerAction[] }[] = [
  { id: "gifts", actions: ["sparks", "freeze"] },
  { id: "safety", actions: ["reset_nickname", "revoke_ranking", "restore_ranking", "ban", "unban"] },
  { id: "account", actions: ["birth", "signout", "delete"] },
];
const DANGER = new Set<PlayerAction>(["ban", "revoke_ranking", "signout", "delete"]);
const REPORT_TONE: Record<string, PillTone> = { open: "danger", actioned: "ok", dismissed: "neutral" };
const ACTIVITY_TONE: Record<string, PillTone> = { now: "ok", today: "ok", week: "ok", month: "neutral", quiet: "warn", never: "neutral" };

function MiniTable({ head, children, min = 480 }: { head: readonly string[]; children: ReactNode; min?: number }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: min }}>
        <thead>
          <tr className="text-muted text-left text-[12px]">
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
const td = "border-line border-t px-2 py-2 align-top";
const none = <p className="text-muted text-[13px]">{C.noReports}</p>;

/**
 * One player (owner request). Read top to bottom: who they are (account kind and what it means, age group and what
 * it allows, how active they are), anything that needs the team's attention, how far they've come, then their
 * history. Raw ids sit under Technical details. Every action opens a dialog that asks for a reason; deleting also
 * needs the nickname typed. The server checks all of it again.
 */
const TABS = ["overview", "games", "reports", "rewards"] as const;
type Tab = (typeof TABS)[number];
const isTab = (x: string | null): x is Tab => !!x && (TABS as readonly string[]).includes(x);

export function PlayerDetail({ id, role, backHref }: { id: string; role: Role; backHref: string }) {
  const router = useRouter();
  const q = useAdminQuery<Detail>(["player", id], `/api/admin/players/${id}/detail`);
  const act = useAdminAction<Record<string, unknown>, Record<string, unknown>>("POST", `/api/admin/players/${id}/actions`);
  const [open, setOpen] = useState<PlayerAction | null>(null);
  const [amount, setAmount] = useState("100");
  const [days, setDays] = useState("7");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [done, setDone] = useState<string | null>(null);
  // Tabs (owner, 12 Nov): one part of the history at a time, kept in the address bar (?tab=) so a link opens it.
  const sp = useSearchParams();
  const fromUrl = sp.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(fromUrl) ? fromUrl : "overview");
  const pick = (t: Tab) => {
    setTab(t);
    const u = new URL(window.location.href);
    if (t === "overview") u.searchParams.delete("tab");
    else u.searchParams.set("tab", t);
    window.history.replaceState(null, "", u.toString());
  };

  const back = (
    <Link href={backHref} className="text-muted hover:text-text flex h-11 items-center gap-1.5 self-start text-[13px] font-semibold">
      <Icon name="arrow-left" size={16} />
      {C.back}
    </Link>
  );
  if (q.isPending) return <RowsSkeleton rows={10} height={56} />;
  if (q.error)
    return (
      <div className="flex flex-col gap-3 p-6">
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
        {back}
      </div>
    );
  const d = q.data;
  const p = d.profile;
  const statuses = playerStatuses({ ...p, flagged: d.stats.flagged }).filter((s) => s !== "flagged" && s !== "test");
  const activity = activityOf(p.last_seen_at);
  const allowed = (a: PlayerAction) => {
    if (!can(role, ACTION_PERMISSION[a])) return false;
    if (a === "unban") return !!p.banned_at;
    if (a === "ban") return !p.banned_at;
    if (a === "revoke_ranking") return !p.ranking_revoked;
    if (a === "restore_ranking") return p.ranking_revoked;
    if (a === "signout" || a === "delete") return !d.account.isAdmin;
    return true;
  };
  const groups = GROUPS.map((g) => ({ ...g, actions: g.actions.filter(allowed) })).filter((g) => g.actions.length);
  const amountN = Number(amount);
  const amountOk = Number.isInteger(amountN) && amountN !== 0 && Math.abs(amountN) <= SPARKS_LIMIT;
  const birthOk = !!birthYear && !!birthMonth && !birthProblem(Number(birthYear), Number(birthMonth));
  const birthBand = birthOk ? ageBandOf(Number(birthYear), Number(birthMonth)) : null;
  const canReports = can(role, "moderation.read");
  const openReports = d.reportsReceived.filter((r) => r.status === "open").length;
  const attention = !!p.banned_at || p.ranking_revoked || openReports > 0 || d.stats.flagged > 0 || p.is_test;

  const confirm = ({ reason, confirm }: { reason: string; confirm: string }) => {
    if (!open) return;
    const input: Record<string, unknown> = { action: open, reason };
    if (open === "sparks") input.amount = amountN;
    if (open === "ban") input.days = days ? Number(days) : null;
    if (open === "delete") input.confirm = confirm;
    if (open === "birth") Object.assign(input, { year: Number(birthYear), month: Number(birthMonth) });
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
                  : action === "birth"
                    ? C.done.birth(band(String(r.age_band)))
                    : C.done[action],
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      {back}

      {/* Who: name, account kind, standing and activity in one glance. */}
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] break-all">{p.nickname}</h1>
          <span className="flex flex-wrap gap-1">
            <Pill tone={d.account.type === "guest" ? "warn" : "ok"}>{C.accountPill[d.account.type]}</Pill>
            <Pill>{band(p.age_band)}</Pill>
            {statuses.map((s) => (
              <Pill key={s} tone={STATUS_TONE[s]}>
                {C.statuses[s]}
              </Pill>
            ))}
            <Pill tone={ACTIVITY_TONE[activity]}>{C.activity[activity]}</Pill>
          </span>
        </div>
        <p className="text-muted text-[14px]">{C.purposeDetail}</p>
      </header>

      <div aria-live="polite" className="empty:hidden">
        {done && (
          <Notice tone="ok" icon="check-circle">
            {done}
          </Notice>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* What needs doing comes before the history. */}
          <Card title={C.attention} id="pd-attention" hint={attention ? C.attentionHint : undefined}>
            {!attention ? (
              <Notice tone="ok" icon="check-circle">
                {C.allClear}
              </Notice>
            ) : (
              <div className="flex flex-col gap-2">
                {p.banned_at && (
                  <Notice tone="danger" icon="prohibit">
                    {C.bannedLine(p.banned_until ? `${timeUntil(p.banned_until)} (${dayDate(p.banned_until)})` : null)}{" "}
                    {p.ban_reason ? C.banReason(p.ban_reason) : ""}
                  </Notice>
                )}
                {openReports > 0 && (
                  <Notice
                    tone="danger"
                    icon="flag"
                    action={canReports ? <AttentionLink href="/admin/moderation">{C.reviewReports}</AttentionLink> : undefined}
                  >
                    {C.openReportsLine(openReports)}
                  </Notice>
                )}
                {d.stats.flagged > 0 && (
                  <Notice
                    tone="warn"
                    icon="warning"
                    action={canReports ? <AttentionLink href="/admin/moderation?tab=flagged">{C.reviewScores}</AttentionLink> : undefined}
                  >
                    {C.flaggedLine(d.stats.flagged)}
                  </Notice>
                )}
                {p.ranking_revoked && (
                  <Notice tone="warn" icon="flag">
                    {C.revoked}
                  </Notice>
                )}
                {p.is_test && <Notice icon="info">{C.testPlayer}</Notice>}
              </div>
            )}
          </Card>

          <Tabs<Tab>
            label={C.tabs.label}
            idBase="pd"
            value={tab}
            onChange={pick}
            items={[
              { id: "overview", label: C.tabs.overview },
              { id: "games", label: C.tabs.games },
              { id: "reports", label: C.tabs.reports, count: openReports || undefined },
              { id: "rewards", label: C.tabs.rewards },
            ]}
          />
          <div
            key={tab}
            role="tabpanel"
            id={`pd-panel-${tab}`}
            aria-labelledby={`pd-tab-${tab}`}
            className="admin-fade flex flex-col gap-4"
          >
            {tab === "overview" && (
              <>
                <Card title={C.whoTitle} id="pd-who">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Fact
                      label={C.accountTitle}
                      value={C.accountKind[d.account.type]}
                      hint={C.accountMeaning[d.account.type]}
                      tone={d.account.type === "guest" ? "warn" : undefined}
                    />
                    <Fact
                      label={C.ageBand}
                      value={
                        <>
                          {band(p.age_band)}
                          {can(role, "players.age") && (
                            <span className="text-muted block text-[13px] font-medium">
                              {C.birth}:{" "}
                              {p.birth_year && p.birth_month ? `${ageCopy.months[p.birth_month - 1]} ${p.birth_year}` : C.birthNotGiven}
                            </span>
                          )}
                        </>
                      }
                      hint={C.ageMeaning[p.age_band]}
                    />
                    <Fact
                      label={C.lastSeen}
                      value={C.activity[activity]}
                      hint={p.last_seen_at ? <When iso={p.last_seen_at} /> : undefined}
                      tone={activity === "quiet" ? "warn" : undefined}
                    />
                    <Fact
                      label={C.joinedOn}
                      value={<span title={exactTime(p.created_at)}>{dayDate(p.created_at)}</span>}
                      hint={timeAgo(p.created_at)}
                    />
                    {d.account.type !== "guest" && (
                      <Fact
                        label={C.email}
                        value={<span className="num text-[14px] break-all">{d.account.email ?? C.noEmail}</span>}
                        hint={!d.account.emailVisible && d.account.email ? C.emailMasked : undefined}
                      />
                    )}
                    {d.account.type !== "guest" && (
                      <Fact label={C.signedInLast} value={d.account.lastSignInAt ? <When iso={d.account.lastSignInAt} /> : C.never} />
                    )}
                  </div>
                  {d.account.isAdmin && <Notice icon="info">{C.adminAccount}</Notice>}
                </Card>
                <Card title={C.progress} id="pd-progress">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Figure value={p.level} label={C.statLabels.level} />
                    <Figure value={fmt(d.stats.clears)} label={C.statLabels.clears} />
                    <Figure value={d.stats.streak} label={C.statLabels.streak} />
                    <Figure value={fmt(p.sparks)} label={C.statLabels.sparks} />
                  </div>
                  <TechDetails label={C.moreStats}>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      {(
                        [
                          [C.statLabels.xp, fmt(p.xp)],
                          [C.statLabels.best, d.stats.bestStreak],
                          [C.statLabels.freezes, d.stats.freezes],
                          [C.statLabels.shield, d.stats.shieldAt ? dayDate(d.stats.shieldAt) : C.shieldNone],
                          [C.statLabels.attempts, fmt(d.stats.attempts)],
                          [C.statLabels.daily, fmt(d.stats.dailyClears)],
                          [C.statLabels.badges, d.stats.badges],
                          [C.statLabels.flagged, d.stats.flagged],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="text-muted">{k}</dt>
                          <dd className="num font-semibold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </TechDetails>
                </Card>
              </>
            )}
            {tab === "games" && (
              <>
                <Card title={C.games.title} id="pd-games" hint={C.games.hint}>
                  <PlayerGamesTable
                    rows={allGames(
                      d.attempts.filter((a) => a.mode !== "tutorial"),
                      d.boardGames ?? [],
                    )}
                  />
                </Card>
                <Card title={C.competitive} id="pd-ratings" hint={C.competitiveHint}>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h3 className="text-[14px] font-bold">{C.ratings}</h3>
                      {!d.ratings?.length ? (
                        <p className="text-muted text-[13px]">{C.noRatings}</p>
                      ) : (
                        <MiniTable head={C.ratingsHead} min={300}>
                          {d.ratings.map((r) => (
                            <tr key={r.track}>
                              <td className={`${td} font-semibold`}>{cap(r.track)}</td>
                              <td className={`${td} num`}>{Math.round(r.rating)}</td>
                              <td className={`${td} num`}>{fmt(r.games)}</td>
                              <td className={`${td} text-muted whitespace-nowrap`}>
                                <When iso={r.updated_at} />
                              </td>
                            </tr>
                          ))}
                        </MiniTable>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h3 className="text-[14px] font-bold">{C.rankMoves}</h3>
                      {!d.rankMoves?.length ? (
                        <p className="text-muted text-[13px]">{C.noRankMoves}</p>
                      ) : (
                        <Paged items={d.rankMoves} label={C.pageLabel(C.rankMoves)}>
                          {(rows) => (
                            <MiniTable head={C.rankMovesHead} min={340}>
                              {rows.map((r) => (
                                <tr key={`${r.ref}:${r.created_at}`}>
                                  <td className={`${td} num text-muted`}>{r.ref}</td>
                                  <td className={td}>{r.track ? cap(r.track) : C.noEmail}</td>
                                  <td className={`${td} num font-semibold ${(r.delta ?? 0) < 0 ? "text-danger" : "text-accent"}`}>
                                    {r.delta === null ? C.noEmail : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)}`}
                                  </td>
                                  <td className={`${td} text-muted whitespace-nowrap`}>
                                    <When iso={r.created_at} />
                                  </td>
                                </tr>
                              ))}
                            </MiniTable>
                          )}
                        </Paged>
                      )}
                    </div>
                  </div>
                </Card>
              </>
            )}
            {tab === "reports" && (
              <>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {(
                    [
                      ["pd-rr", C.reportsReceived, d.reportsReceived],
                      ["pd-rm", C.reportsMade, d.reportsMade],
                    ] as const
                  ).map(([sid, title, list]) => (
                    <Card key={sid} title={title} id={sid}>
                      {!list.length ? (
                        none
                      ) : (
                        <Paged items={list} label={C.pageLabel(title)}>
                          {(rows) => (
                            <MiniTable head={C.reportsHead} min={340}>
                              {rows.map((r) => (
                                <tr key={r.id}>
                                  <td className={`${td} font-semibold`}>{C.reportReasons[r.reason] ?? cap(r.reason)}</td>
                                  <td className={`${td} text-muted`}>{C.reportTargets[r.target_type] ?? r.target_type}</td>
                                  <td className={td}>
                                    <Pill tone={REPORT_TONE[r.status] ?? "neutral"}>{C.reportStatus[r.status] ?? r.status}</Pill>
                                  </td>
                                  <td className={`${td} text-muted whitespace-nowrap`}>
                                    <When iso={r.created_at} />
                                  </td>
                                </tr>
                              ))}
                            </MiniTable>
                          )}
                        </Paged>
                      )}
                    </Card>
                  ))}
                </div>
                <Card title={C.moderation} id="pd-audit" hint={C.moderationHint}>
                  {!d.audit.length ? (
                    <p className="text-muted text-[13px]">{C.noModeration}</p>
                  ) : (
                    <Paged items={d.audit} label={C.pageLabel(C.moderation)}>
                      {(rows) => <AuditList rows={rows} />}
                    </Paged>
                  )}
                </Card>
              </>
            )}
            {tab === "rewards" && (
              <>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card title={C.sparksLedger} id="pd-ledger" hint={C.sparksHint}>
                    {!d.sparks.length ? (
                      <p className="text-muted text-[13px]">{C.noLedger}</p>
                    ) : (
                      <Paged items={d.sparks} label={C.pageLabel(C.sparksLedger)}>
                        {(rows) => (
                          <ul className="flex flex-col text-[13px]">
                            {rows.map((s) => (
                              <li key={s.id} className="border-line flex items-center gap-2 border-t py-1.5 first:border-t-0">
                                <span
                                  className={`num w-16 shrink-0 text-right font-semibold ${s.amount < 0 ? "text-danger" : "text-accent"}`}
                                >
                                  {s.amount > 0 ? "+" : ""}
                                  {fmt(s.amount)}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{C.sparkSources[s.source] ?? C.sparkFallback(s.source)}</span>
                                <When iso={s.created_at} className="text-muted shrink-0" />
                              </li>
                            ))}
                          </ul>
                        )}
                      </Paged>
                    )}
                  </Card>
                  <Card title={C.league} id="pd-league">
                    {!d.league.length ? (
                      <p className="text-muted text-[13px]">{C.noLeague}</p>
                    ) : (
                      <Paged items={d.league} label={C.pageLabel(C.league)}>
                        {(rows) => (
                          <MiniTable head={C.leagueHead} min={340}>
                            {rows.map((l) => (
                              <tr key={l.week_start}>
                                <td className={`${td} whitespace-nowrap`}>{dayDate(l.week_start)}</td>
                                <td className={td}>{LEAGUE_TIERS[l.tier] ?? l.tier}</td>
                                <td className={`${td} num`}>{fmt(l.points)}</td>
                                <td className={`${td} num`}>{l.rank ?? C.noEmail}</td>
                                <td className={`${td} text-muted`}>{l.result ? (C.leagueResults[l.result] ?? l.result) : C.noEmail}</td>
                              </tr>
                            ))}
                          </MiniTable>
                        )}
                      </Paged>
                    )}
                  </Card>
                </div>
                <Card title={C.inventory} id="pd-inv">
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
                </Card>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card title={C.actions} id="pd-actions" hint={groups.length ? C.actionsHint : undefined}>
            {!groups.length ? (
              <p className="text-muted text-[13px]">{C.readOnly}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((g) => (
                  <div key={g.id} role="group" aria-labelledby={`pd-ag-${g.id}`} className="flex flex-col gap-1.5">
                    <h3 id={`pd-ag-${g.id}`} className="text-muted text-[12px] font-semibold">
                      {C.actionGroups[g.id]}
                    </h3>
                    {g.actions.map((a) => (
                      <Btn
                        key={a}
                        size="lg"
                        tone={a === "delete" ? "danger" : "secondary"}
                        className="justify-start"
                        title={C.actionHelp[a]}
                        onClick={() => {
                          act.reset();
                          setDone(null);
                          if (a === "birth") {
                            setBirthYear(p.birth_year ? String(p.birth_year) : "");
                            setBirthMonth(p.birth_month ? String(p.birth_month) : "");
                          }
                          setOpen(a);
                        }}
                      >
                        {C.actionLabels[a]}
                      </Btn>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
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
          ready={(open !== "sparks" || amountOk) && (open !== "birth" || !!birthBand)}
          busy={act.isPending}
          error={act.error ? errorText(act.error) : null}
          onCancel={() => setOpen(null)}
          onConfirm={confirm}
        >
          {open === "sparks" && (
            <Field label={C.amount} htmlFor="pd-amount" hint={amountOk ? undefined : C.amountInvalid}>
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
          {open === "birth" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={C.birthMonth} htmlFor="pd-birth-month">
                <Select
                  id="pd-birth-month"
                  value={birthMonth}
                  onValueChange={setBirthMonth}
                  options={[{ value: "", label: ageCopy.pickMonth }, ...ageCopy.months.map((m, i) => ({ value: String(i + 1), label: m }))]}
                  className="h-11 w-full"
                />
              </Field>
              <Field label={C.birthYear} htmlFor="pd-birth-year">
                {/* R4-13: nobody under 13 has a profile, so the list starts at this year minus 13. */}
                <Select
                  id="pd-birth-year"
                  value={birthYear}
                  onValueChange={setBirthYear}
                  options={[
                    { value: "", label: ageCopy.pickYear },
                    ...birthYears(new Date(), MIN_AGE).map((y) => ({ value: String(y), label: String(y) })),
                  ]}
                  className="num h-11 w-full"
                />
              </Field>
              {birthOk && (
                <p role="status" className="text-muted col-span-2 text-[13px]">
                  {birthBand ? C.newBand(band(birthBand)) : ageCopy.under13Title}
                </p>
              )}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

function AttentionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-surface-raised hover:bg-line inline-flex h-10 shrink-0 items-center gap-1 rounded-[10px] px-3 text-[13px] font-semibold"
    >
      {children}
      <Icon name="arrow-right" size={14} />
    </Link>
  );
}

/** What the team (or the app) did to this player, as sentences; the raw actions and data fold away underneath. */
function AuditList({ rows }: { rows: readonly Detail["audit"][number][] }) {
  return (
    <>
      <ul className="flex flex-col">
        {rows.map((a) => {
          const detail = (a.detail ?? {}) as Record<string, unknown>;
          const reason = typeof detail.reason === "string" ? detail.reason : null;
          const days = typeof detail.days === "number" ? detail.days : null;
          return (
            <li key={a.id} className="border-line flex flex-col gap-0.5 border-t py-2.5 text-[14px] first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">
                  {C.auditActions[a.action] ?? C.auditFallback(a.action)}
                  {days ? ` ${C.forDays(days)}` : ""}
                </span>
                <span className="text-muted text-[13px]">
                  {C.byWho(a.actor ?? C.system)} · <When iso={a.created_at} />
                </span>
              </div>
              {reason && <span className="text-muted text-[13px]">{C.banReason(reason)}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
