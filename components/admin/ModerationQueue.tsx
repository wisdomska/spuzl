"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { clock } from "@/lib/admin/dates";
import { daysSince, duration, exactTime, timeAgo } from "@/lib/admin/people-format";
import { MODERATION_SORT } from "@/lib/admin/sorting";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { PEN_COLORS, PEN_WIDTHS, strokePath, type Stroke } from "@/lib/party-adult/strokes";
import { Pagination, usePager } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { useUrlFilters, useUrlSort } from "./useUrlFilters";
import { Fact, PageHead, TechDetails, TechRow, When } from "./people-ui";
import { Btn, Empty, Notice, Pill, RowsSkeleton, Tabs, type PillTone } from "./ui";

type Tab = "reports" | "nicknames" | "party" | "flagged";
interface Row {
  id: string;
  ref: string;
  title: string;
  kind: string;
  status: string;
  created_at: string;
  player_id: string | null;
}
interface Queue extends AdminPage<Row> {
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

const C = adminCopy.moderation;
const K = C.cases;
const TABS: Tab[] = ["reports", "nicknames", "party", "flagged"];
const KINDS = ["player", "crew", "score", "content"] as const;
const FILTERS = { tab: "reports", status: "open", kind: "", source: "" } as const;
const ALLOWED = { tab: TABS, status: ["open", "actioned", "dismissed", "all"], kind: [...KINDS], source: ["five"] };
type SortKey = (typeof MODERATION_SORT.keys)[number];
/** Flagged scores all share a kind and status, so only their age sorts. */
const cols = (flagged: boolean): HeadCol<SortKey>[] => [
  { label: C.head[0] },
  { label: C.head[1], sort: flagged ? undefined : "kind" },
  { label: C.head[2], sort: flagged ? undefined : "status" },
  { label: C.head[3], sort: "created_at" },
];

const STATUS_TONE: Record<string, PillTone> = { open: "danger", flagged: "danger", actioned: "ok", dismissed: "neutral" };
const selectCls = "bg-bg text-text h-11 rounded-[10px] px-2 text-[14px] font-semibold shadow-[inset_0_0_0_1px_var(--line)]";

/**
 * Reports (was Moderation; design: Admin moderation): player reports, nickname reports, party rounds and suspicious
 * scores, each with a case panel that says what happened and what every button does to the player. Actions that
 * take something away from a player ask once more in plain words before they run.
 */
export function ModerationQueue({ canWrite }: { canWrite: boolean }) {
  const [filters, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const tab = filters.tab as Tab;
  const status = filters.status;
  const kind = tab === "reports" ? filters.kind : "";
  // Flagged scores: all, or the Daily Five's only (R2-05).
  const five = tab === "flagged" && filters.source === "five";
  const [sel, setSel] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const pager = usePager();
  const sort = useUrlSort(MODERATION_SORT);
  const q = useAdminQuery<Queue>(
    ["moderation", tab, status, kind, five, sort.query, pager.query],
    `/api/admin/moderation?tab=${tab}&status=${tab === "flagged" ? "open" : status}${kind ? `&kind=${kind}` : ""}${five ? "&five=1" : ""}&${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  const selected = q.data?.rows.find((r) => r.id === sel) ?? q.data?.rows[0] ?? null;
  // Open on the first tab with something waiting (the header count adds up all four tabs), once per visit.
  // Adjusted during render (React's pattern for state derived from the first response), not in an effect.
  const [picked, setPicked] = useState(false);
  const counts = q.data?.counts;
  if (!picked && counts) {
    setPicked(true);
    const first = TABS.find((t) => counts[t] > 0);
    if (counts[tab] === 0 && first) {
      setFilters({ tab: first });
      setSel(null);
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 xl:grid-cols-[1fr_440px]">
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">
        <PageHead
          title={C.title}
          purpose={C.purpose}
          meta={q.data && <Pill tone={q.data.open ? "danger" : "ok"}>{C.open(q.data.open)}</Pill>}
        />
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <Tabs<Tab>
              label={C.queue}
              value={tab}
              onChange={(t) => (setFilters({ tab: t }), setSel(null), setDone(null))}
              items={TABS.map((id) => ({ id, label: C.tabs[id], count: q.data?.counts[id] }))}
            />
          </div>
          <p className="text-muted text-[13px]">{C.tabHelp[tab]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {tab === "flagged" ? (
            <label className="text-muted flex items-center gap-2 text-[13px] font-semibold">
              {C.source}
              <select value={filters.source} onChange={(e) => (setFilters({ source: e.target.value }), setSel(null))} className={selectCls}>
                <option value="">{C.sources.all}</option>
                <option value="five">{C.sources.five}</option>
              </select>
            </label>
          ) : (
            <>
              <label className="text-muted flex items-center gap-2 text-[13px] font-semibold">
                {C.showing}
                <select value={status} onChange={(e) => (setFilters({ status: e.target.value }), setSel(null))} className={selectCls}>
                  {(["open", "actioned", "dismissed", "all"] as const).map((s) => (
                    <option key={s} value={s}>
                      {C.statuses[s]}
                    </option>
                  ))}
                </select>
              </label>
              {tab === "reports" && (
                <label className="text-muted flex items-center gap-2 text-[13px] font-semibold">
                  {C.kind}
                  <select value={kind} onChange={(e) => (setFilters({ kind: e.target.value }), setSel(null))} className={selectCls}>
                    <option value="">{C.anyKind}</option>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {C.kinds[k]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
        </div>
        <div aria-live="polite" className="empty:hidden">
          {done && (
            <Notice tone="ok" icon="check-circle">
              {done}
            </Notice>
          )}
        </div>
        <div className="bg-surface max-h-[70dvh] overflow-auto rounded-[16px]">
          {q.isPending ? (
            <RowsSkeleton />
          ) : q.error ? (
            <div className="p-3">
              <Notice tone="danger" icon="warning">
                {errorText(q.error)}
              </Notice>
            </div>
          ) : !q.data.rows.length ? (
            <Empty icon="shield-check">
              {q.data.open > 0 && status === "open"
                ? C.emptyOthers(q.data.open)
                : status === "open" || tab === "flagged"
                  ? C.empty
                  : C.emptyClosed}
            </Empty>
          ) : (
            <table className="w-full min-w-[560px] table-fixed border-collapse [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[1] [&_thead_th]:bg-[var(--surface-raised)]">
              <colgroup>
                <col />
                <col className="w-[150px]" />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
              </colgroup>
              <SortHead cols={cols(tab === "flagged")} sort={sort} />
              <tbody>
                {q.data.rows.map((r) => {
                  const on = selected?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={`border-line cursor-pointer border-t ${on ? "bg-[var(--success-tint)]" : "hover:bg-surface-raised/50"}`}
                      onClick={() => setSel(r.id)}
                    >
                      <td className="px-3 py-2 align-middle text-[14px] font-medium">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSel(r.id)}
                          className="flex min-h-11 w-full items-center text-left hover:underline"
                        >
                          {r.title}
                        </button>
                      </td>
                      <td className="text-muted px-3 py-2 align-middle text-[13px] font-medium">{C.kindLabels[r.kind] ?? r.kind}</td>
                      <td className="px-3 py-2 align-middle">
                        <Pill tone={STATUS_TONE[r.status] ?? "warn"}>{C.statusPill[r.status] ?? r.status}</Pill>
                      </td>
                      <td className="text-muted px-3 py-2 align-middle text-[13px]">
                        <When iso={r.created_at} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {q.data && <Pagination pager={pager} total={q.data.total} />}
      </div>
      <aside
        aria-label={C.caseLabel}
        className="bg-surface border-line flex min-h-[400px] flex-col gap-3 border-t p-4 sm:p-5 xl:sticky xl:top-0 xl:max-h-dvh xl:overflow-y-auto xl:border-t-0 xl:border-l"
      >
        {!selected ? (
          <Empty icon="shield-check">{C.pickCase}</Empty>
        ) : tab === "flagged" ? (
          <FlaggedCase key={selected.id} id={selected.id} canWrite={canWrite} onDone={setDone} />
        ) : (
          <ReportCase key={selected.id} id={selected.id} nickname={tab === "nicknames"} canWrite={canWrite} onDone={setDone} />
        )}
      </aside>
    </div>
  );
}

const accountAge = (iso: string) => {
  const d = daysSince(iso);
  return { text: K.accountAge(d), young: d < 7 };
};

function PlayerLink({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/players/${id}`}
      className="text-accent inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-semibold hover:underline"
    >
      {C.openPlayer}
      <Icon name="arrow-right" size={14} />
    </Link>
  );
}

/** One more plain-words check before a button takes something away from a player. */
interface Ask {
  label: string;
  help: string;
  run: () => void;
}
function AskBox({ ask, busy, onCancel }: { ask: Ask; busy: boolean; onCancel: () => void }) {
  return (
    <div
      role="group"
      aria-label={K.sure(ask.label)}
      className="flex flex-col gap-2 rounded-[12px] bg-[var(--danger-tint)] p-3 shadow-[inset_0_0_0_1px_var(--danger)]"
    >
      <p className="text-[14px] font-semibold">{K.sure(ask.label)}</p>
      <p className="text-[13px]">{ask.help}</p>
      <div className="grid grid-cols-2 gap-2">
        <Btn size="lg" onClick={onCancel} disabled={busy}>
          {K.cancel}
        </Btn>
        <Btn size="lg" tone="danger" disabled={busy} onClick={ask.run}>
          {K.yes(ask.label)}
        </Btn>
      </div>
    </div>
  );
}

/** A labelled button with the one-line consequence under it. */
function Choice({ help, children }: { help: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      <span className="text-muted text-[12px] leading-snug">{help}</span>
    </div>
  );
}

function FlaggedCase({ id, canWrite, onDone }: { id: string; canWrite: boolean; onDone: (msg: string) => void }) {
  const q = useAdminQuery<{
    attempt: {
      ref: string;
      time_ms: number;
      flag_reason: string | null;
      daily_date: string | null;
      dailyNumber: number | null;
      hints: number;
      mistakes: number;
      mode: string;
    };
    game: { name: string; minTimeMs: number | null };
    player: Player | null;
    bestMs: number | null;
    wallMs: number | null;
    gaps: number[];
  }>(["flagged", id], `/api/admin/moderation/flagged/${id}`);
  const act = useAdminAction<{ decision: "clear" | "reject"; note?: string; ban?: { days: number | null } }>(
    "POST",
    `/api/admin/moderation/flagged/${id}`,
  );
  const [ask, setAsk] = useState<Ask | null>(null);
  if (q.isPending) return <RowsSkeleton rows={5} height={56} />;
  if (q.error)
    return (
      <Notice tone="danger" icon="warning">
        {errorText(q.error)}
      </Notice>
    );
  const { attempt: a, player, gaps } = q.data;
  const who = player?.nickname ?? K.player;
  const acc = player ? accountAge(player.created_at) : null;
  const max = Math.max(1, ...gaps);
  const median = gaps.length ? [...gaps].sort((x, y) => x - y)[Math.floor(gaps.length / 2)] : null;
  const decide = (body: Parameters<typeof act.mutateAsync>[0], msg: string) =>
    void act.mutateAsync(body).then(
      () => (setAsk(null), onDone(msg)),
      () => setAsk(null),
    );
  return (
    <>
      <h2 className="font-display text-[18px] font-extrabold">{K.flaggedTitle(who, q.data.game.name)}</h2>
      {player && <PlayerLink id={player.id} />}
      <div className="grid grid-cols-2 gap-2">
        <Fact label={K.claimedTime} value={<span className="num">{duration(a.time_ms)}</span>} tone="danger" />
        <Fact
          label={a.daily_date ? K.fastestThatDay : K.fastest}
          value={<span className="num">{q.data.bestMs ? duration(q.data.bestMs) : K.none}</span>}
        />
        <Fact
          label={K.accountAgeLabel}
          value={acc?.text ?? K.unknown}
          hint={acc?.young ? K.newAccount : undefined}
          tone={acc?.young ? "warn" : undefined}
        />
        <Fact label={K.reports} value={<span className="num">{player?.reports ?? 0}</span>} />
      </div>
      <div className="bg-bg flex flex-col gap-1.5 rounded-[12px] p-3">
        <span className="text-[13px] font-semibold">{K.trace(q.data.game.name, a.dailyNumber, a.mode)}</span>
        {gaps.length ? (
          <>
            <div className="flex h-[60px] items-end gap-0.5" role="img" aria-label={K.traceAria(gaps.length)}>
              {gaps.slice(-40).map((g, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-[2px]"
                  style={{ height: `${Math.max(8, (g / max) * 100)}%`, background: g < 250 ? "var(--danger)" : "var(--admin-bar)" }}
                />
              ))}
            </div>
            <span className="text-muted text-[12px]">{K.traceHelp}</span>
          </>
        ) : (
          <span className="text-muted text-[13px]">{K.noTrace}</span>
        )}
      </div>
      <p className="text-[14px]">
        {K.why(a.flag_reason)} {q.data.game.minTimeMs ? K.floor(duration(q.data.game.minTimeMs)) : ""}
      </p>
      <TechDetails>
        <TechRow k={K.techRef} v={a.ref} />
        <TechRow k={K.techReason} v={a.flag_reason ?? "–"} />
        <TechRow k={K.claimedTime} v={`${clock(a.time_ms)} (${a.time_ms} ms)`} />
        {median !== null && <TechRow k={K.techMedian} v={`${median} ms`} />}
        {q.data.wallMs !== null && <TechRow k={K.techWall} v={clock(q.data.wallMs)} />}
      </TechDetails>
      {act.error && (
        <Notice tone="danger" icon="warning">
          {errorText(act.error)}
        </Notice>
      )}
      {act.isSuccess && (
        <Notice tone="ok" icon="check-circle">
          {K.resolved}
        </Notice>
      )}
      {canWrite && !act.isSuccess && (
        <div className="mt-auto flex flex-col gap-3">
          {ask ? (
            <AskBox ask={ask} busy={act.isPending} onCancel={() => setAsk(null)} />
          ) : (
            <>
              <Choice help={K.clearHelp}>
                <Btn
                  size="lg"
                  tone="primary"
                  disabled={act.isPending}
                  onClick={() => decide({ decision: "clear", note: K.clearedNote }, K.doneCleared(who))}
                >
                  {K.clear}
                </Btn>
              </Choice>
              <Choice help={K.rejectHelp}>
                <Btn
                  size="lg"
                  disabled={act.isPending}
                  onClick={() => decide({ decision: "reject", note: K.rejectedNote }, K.doneRejected(who))}
                >
                  {K.reject}
                </Btn>
              </Choice>
              <Choice help={K.voidBanHelp}>
                <Btn
                  size="lg"
                  tone="danger"
                  disabled={act.isPending}
                  onClick={() =>
                    setAsk({
                      label: K.voidBan,
                      help: K.voidBanHelp,
                      run: () => decide({ decision: "reject", note: K.voidBan, ban: { days: 7 } }, K.doneVoidBan(who)),
                    })
                  }
                >
                  {K.voidBan}
                </Btn>
              </Choice>
            </>
          )}
        </div>
      )}
    </>
  );
}

function ReportCase({
  id,
  nickname,
  canWrite,
  onDone,
}: {
  id: string;
  nickname: boolean;
  canWrite: boolean;
  onDone: (msg: string) => void;
}) {
  const q = useAdminQuery<{
    report: {
      ref: string;
      reason: string;
      status: string;
      target_type: string;
      target_id: string;
      created_at: string;
      resolution: string | null;
      snapshot?: PartySnapshot | null;
    };
    target: Player | null;
    reporter: { nickname: string } | null;
    related: { ref: string; reason: string; status: string; created_at: string }[];
    blockDays: number | null;
  }>(["report", id], `/api/admin/moderation/reports/${id}`);
  const decide = useAdminAction<
    { decision: "dismiss" | "actioned" | "reopen"; note?: string },
    { blockedUntil?: string | null; blockLifted?: boolean }
  >("POST", `/api/admin/moderation/reports/${id}`);
  const player = useAdminAction<
    { action: string; days?: number | null; reason?: string; nickname?: string; pid: string },
    { nickname: string | null }
  >("POST", (i) => `/api/admin/players/${i.pid}`);
  const [rename, setRename] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  if (q.isPending) return <RowsSkeleton rows={5} height={56} />;
  if (q.error)
    return (
      <Notice tone="danger" icon="warning">
        {errorText(q.error)}
      </Notice>
    );
  const { report: r, target: t } = q.data;
  const acc = t ? accountAge(t.created_at) : null;
  const who = t?.nickname ?? adminCopy.players.reportTargets[r.target_type] ?? r.target_type;
  const reason = adminCopy.players.reportReasons[r.reason] ?? r.reason;
  const run = async (
    action: string,
    extra: { days?: number | null; reason?: string; nickname?: string } = {},
    close: "actioned" | null = "actioned",
  ) => {
    if (!t) return;
    try {
      const res = await player.mutateAsync({ pid: t.id, action, ...extra });
      if (close) await decide.mutateAsync({ decision: close, note: action });
      onDone(res.nickname ? K.doneRenamed(t.nickname, res.nickname) : K.doneAction(t.nickname, K.doneActions[action] ?? action));
    } catch {
      // the error shows in the panel (player.error / decide.error)
    } finally {
      setAsk(null);
    }
  };
  const confirmFirst = (label: string, help: string, go: () => void) => setAsk({ label, help, run: go });
  const err = decide.error ?? player.error;
  const busy = player.isPending || decide.isPending;
  const resolution = r.resolution ? (K.resolutionWords[r.resolution] ?? r.resolution) : null;
  return (
    <>
      <h2 className="font-display text-[18px] font-extrabold">{K.reportTitle(who)}</h2>
      {t && <PlayerLink id={t.id} />}
      <div className="grid grid-cols-2 gap-2">
        <Fact label={K.reason} value={reason} tone="danger" />
        <Fact label={K.reportsOnTarget} value={<span className="num">{t ? t.reports : q.data.related.length + 1}</span>} />
        <Fact
          label={K.accountAgeLabel}
          value={acc?.text ?? K.notApplicable}
          hint={acc?.young ? K.newAccount : undefined}
          tone={acc?.young ? "warn" : undefined}
        />
        <Fact label={K.flaggedScores} value={<span className="num">{t ? t.flagged : 0}</span>} />
      </div>
      <div className="bg-bg flex flex-col gap-1 rounded-[12px] p-3 text-[14px]">
        <span>
          <span title={exactTime(r.created_at)}>{K.reportedBy(q.data.reporter?.nickname ?? K.aPlayer, timeAgo(r.created_at))}</span>{" "}
          <b>{K.statusNow(C.statusPill[r.status] ?? r.status)}</b>
          {K.resolution(resolution)}
        </span>
        {t?.banned_at && <span className="text-danger font-semibold">{K.banned(t.banned_until ? t.banned_until.slice(0, 10) : null)}</span>}
        {t?.ranking_revoked && <span className="text-gold font-semibold">{K.rankingRevoked}</span>}
        {q.data.related.length > 0 && (
          <span className="text-muted text-[13px]">
            {K.also(
              q.data.related.map(
                (x) => `${adminCopy.players.reportReasons[x.reason] ?? x.reason} (${(C.statusPill[x.status] ?? x.status).toLowerCase()})`,
              ),
            )}
          </span>
        )}
      </div>
      {r.target_type === "party" && r.snapshot && <PartySnapshotView s={r.snapshot} />}
      {r.target_type === "party" && q.data.blockDays !== null && r.status === "open" && (
        <span className="text-muted text-[13px] font-medium">{C.party.blockNote(q.data.blockDays)}</span>
      )}
      <TechDetails>
        <TechRow k={K.techRef} v={r.ref} />
        <TechRow k="target" v={`${r.target_type}:${r.target_id}`} />
        <TechRow k="status" v={r.status} />
        {r.resolution && <TechRow k="resolution" v={r.resolution} />}
        {q.data.related.length > 0 && <TechRow k="related" v={q.data.related.map((x) => x.ref).join(", ")} />}
      </TechDetails>
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {decide.data?.blockLifted ? (
          <Notice tone="ok" icon="check-circle">
            {decide.data.blockedUntil ? C.party.stillBlocked(decide.data.blockedUntil.slice(0, 10)) : C.party.unblocked}
          </Notice>
        ) : (
          decide.data?.blockedUntil && (
            <Notice tone="ok" icon="check-circle">
              {C.party.blocked(decide.data.blockedUntil.slice(0, 10))}
            </Notice>
          )
        )}
        {err && (
          <Notice tone="danger" icon="warning">
            {errorText(err)}
          </Notice>
        )}
        {player.data?.nickname && (
          <Notice tone="ok" icon="check-circle">
            {K.renamed(player.data.nickname)}
          </Notice>
        )}
      </div>
      {canWrite && (
        <div className="mt-auto flex flex-col gap-4">
          {ask ? (
            <AskBox ask={ask} busy={busy} onCancel={() => setAsk(null)} />
          ) : (
            <>
              {t && (
                <div role="group" aria-labelledby="rc-act" className="flex flex-col gap-2">
                  <h3 id="rc-act" className="text-muted text-[12px] font-semibold">
                    {K.actOnPlayer}
                  </h3>
                  {nickname && (
                    <form
                      className="flex flex-col gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run("rename", { nickname: rename || undefined });
                      }}
                    >
                      <label htmlFor="rename" className="text-muted text-[12px] font-semibold">
                        {K.newNickname}
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="rename"
                          value={rename}
                          onChange={(e) => setRename(e.target.value)}
                          placeholder={K.newNicknamePlaceholder}
                          className="bg-bg h-11 min-w-0 flex-1 rounded-[12px] px-3 text-[14px] shadow-[inset_0_0_0_1px_var(--line)]"
                        />
                        <Btn type="submit" size="lg" disabled={busy}>
                          {K.rename}
                        </Btn>
                      </div>
                      <span className="text-muted text-[12px]">{K.renameHelp}</span>
                    </form>
                  )}
                  <Choice help={nickname ? K.ban7Help : K.voidBanHelp}>
                    <Btn
                      size="lg"
                      tone="danger"
                      disabled={busy}
                      onClick={() =>
                        confirmFirst(
                          nickname ? K.ban7 : K.voidBan,
                          nickname ? K.ban7Help : K.voidBanHelp,
                          () => void run(nickname ? "ban" : "ban_void", { days: 7, reason: K.banReason(r.ref, r.reason) }),
                        )
                      }
                    >
                      {nickname ? K.ban7 : K.voidBan}
                    </Btn>
                  </Choice>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Btn
                      disabled={busy}
                      title={t.ranking_revoked ? undefined : K.revokeHelp}
                      onClick={() =>
                        t.ranking_revoked
                          ? void run("restore_ranking", {}, null)
                          : confirmFirst(K.revokeRanking, K.revokeHelp, () => void run("revoke_ranking", {}, null))
                      }
                    >
                      {t.ranking_revoked ? K.restoreRanking : K.revokeRanking}
                    </Btn>
                    <Btn
                      disabled={busy}
                      title={K.resetHelp}
                      onClick={() => confirmFirst(K.resetTimes, K.resetHelp, () => void run("reset", {}, null))}
                    >
                      {K.resetTimes}
                    </Btn>
                    <Btn
                      disabled={busy || !t.banned_at}
                      title={t.banned_at ? undefined : K.notBanned}
                      onClick={() => void run("unban", {}, null)}
                    >
                      {K.unban}
                    </Btn>
                  </div>
                </div>
              )}
              <div role="group" aria-labelledby="rc-close" className="flex flex-col gap-2">
                <h3 id="rc-close" className="text-muted text-[12px] font-semibold">
                  {K.closeReport}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {r.status === "open" ? (
                    <>
                      <Btn size="lg" disabled={busy} onClick={() => decide.mutate({ decision: "actioned", note: K.handledNote })}>
                        {K.markActioned}
                      </Btn>
                      <Btn size="lg" disabled={busy} onClick={() => decide.mutate({ decision: "dismiss", note: K.noActionNote })}>
                        {K.dismiss}
                      </Btn>
                    </>
                  ) : (
                    <Btn size="lg" icon="arrow-counter-clockwise" disabled={busy} onClick={() => decide.mutate({ decision: "reopen" })}>
                      {K.reopen}
                    </Btn>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Party content (18+ rooms and the 16+ Family Draw) as the room saw it: the drawing (strokes only), the statements or the guess. */
interface PartySnapshot {
  mode?: string;
  /** the room's mode when it differs from the round's (R2-P5: "drawfam", Family Draw for 16+) */
  room?: string;
  kind?: string;
  code?: string | null;
  round?: number;
  word?: string | null;
  text?: string;
  statements?: string[];
  lie?: number | null;
  strokes?: Stroke[];
}

function PartySnapshotView({ s }: { s: PartySnapshot }) {
  const P = C.party;
  return (
    <div className="bg-bg flex flex-col gap-1.5 rounded-[12px] p-3 text-[13px]">
      <span className="text-muted text-[12px] font-semibold">
        {P.snapshot}: {P.modes[s.room === "drawfam" ? "drawfam" : (s.mode ?? "")] ?? s.mode} {P.kinds[s.kind ?? ""]?.toLowerCase() ?? ""},{" "}
        {P.room(s.code ?? null, s.round ?? 0)}
      </span>
      {s.word && <span className="text-muted">{P.word(s.word)}</span>}
      {s.text !== undefined && <p className="bg-surface rounded-[8px] px-2.5 py-2 text-[14px] font-medium break-words">{s.text}</p>}
      {s.statements && (
        <ol className="flex flex-col gap-1">
          {s.statements.map((t, i) => (
            <li key={i} className="bg-surface rounded-[8px] px-2.5 py-2 text-[14px] font-medium break-words">
              {i + 1}. {t}
              {s.lie === i && <span className="text-danger ml-1.5 text-[12px] font-semibold">({P.lie})</span>}
            </li>
          ))}
        </ol>
      )}
      {s.strokes && (
        <svg viewBox="0 0 1000 1000" role="img" aria-label={P.drawingLabel} className="bg-surface aspect-square w-full rounded-[8px]">
          {s.strokes.map((k, i) => (
            <path
              key={i}
              d={strokePath(k)}
              fill="none"
              stroke={PEN_COLORS[k.c] ?? PEN_COLORS[0]}
              strokeWidth={PEN_WIDTHS[k.w] ?? PEN_WIDTHS[0]}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
