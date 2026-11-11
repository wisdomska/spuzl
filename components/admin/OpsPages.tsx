"use client";

/** Smaller admin tools: shop and events (FR-AD-04), feature flags (FR-AD-07), audit log (FR-AD-08), team. */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { age, todayIso } from "@/lib/admin/dates";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/admin/roles";
import { AUDIT_SORT, CATALOG_SORT, TEAM_SORT } from "@/lib/admin/sorting";
import { WORLD_BY_ID } from "@/lib/catalog";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { PageHead, StatePill } from "./content-ui";
import type { EventQuest, EventStatus } from "@/lib/events";
import { Pagination, usePager } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { useDebouncedFilter, useUrlFilters, useUrlSort, type UrlSort } from "./useUrlFilters";
import { Btn, Empty, Field, Notice, Pill, RowsSkeleton, Tabs, inputCls, type PillTone } from "./ui";
import { Switch } from "@/components/meta/ui";
import {
  AUDIT_TYPE_IDS,
  auditDayLabel,
  auditTime,
  byDay,
  collapseRepeats,
  describeEntry,
  flagName,
  type AuditActor,
  type AuditEntry,
  type AuditNames,
  type AuditRow,
} from "@/lib/admin/audit-log";

function Table<K extends string = string>({
  head,
  sort,
  children,
  min = 640,
}: {
  /** Plain labels, or columns with sort keys for a sortable header. */
  head: (string | HeadCol<K>)[];
  sort?: UrlSort<K>;
  children: ReactNode;
  min?: number;
}) {
  return (
    <table className="w-full border-collapse text-[14px]" style={{ minWidth: min }}>
      <SortHead cols={head.map((h) => (typeof h === "string" ? { label: h } : h))} sort={sort} />
      <tbody>{children}</tbody>
    </table>
  );
}
const td = "border-line border-t px-3 py-2 align-middle";

function Frame({ q, children }: { q: { isPending: boolean; error: unknown }; children: () => ReactNode }) {
  return (
    <div className="bg-surface relative overflow-x-auto rounded-[12px]">
      {q.isPending ? (
        <RowsSkeleton />
      ) : q.error ? (
        <div className="p-3">
          <Notice tone="danger" icon="warning">
            {errorText(q.error)}
          </Notice>
        </div>
      ) : (
        children()
      )}
    </div>
  );
}

function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-semibold disabled:opacity-50 ${on ? "text-accent" : "text-muted"}`}
    >
      <Icon name={on ? "toggle-right" : "toggle-left"} size={26} />
      {on ? adminCopy.common.on : adminCopy.common.off}
    </button>
  );
}

/* ---------------- Shop and events ---------------- */

type Kind = "cosmetics" | "badges" | "quests";
const SHOP = adminCopy.shop;
/** `sort` and `dir` are listed so a tab change can clear them: each catalogue sorts by its own columns. */
const SHOP_FILTERS = { kind: "cosmetics", q: "", sort: "", dir: "" } as const;
const SHOP_ALLOWED = { kind: ["cosmetics", "badges", "quests"] };
const COSMETIC_COLS: HeadCol<(typeof CATALOG_SORT.cosmetics.keys)[number]>[] = [
  { label: SHOP.cosmeticsHead[0], sort: "name" },
  { label: SHOP.cosmeticsHead[1], sort: "type" },
  { label: SHOP.cosmeticsHead[2] },
  { label: SHOP.cosmeticsHead[3], sort: "price" },
  { label: SHOP.cosmeticsHead[4], sort: "active" },
];
const BADGE_COLS: HeadCol<(typeof CATALOG_SORT.badges.keys)[number]>[] = [
  { label: SHOP.badgesHead[0], sort: "name" },
  { label: SHOP.badgesHead[1], sort: "family" },
  { label: SHOP.badgesHead[2] },
  { label: SHOP.badgesHead[3], sort: "sparks" },
  { label: SHOP.badgesHead[4], sort: "secret" },
];
const QUEST_COLS: HeadCol<(typeof CATALOG_SORT.quests.keys)[number]>[] = [
  { label: SHOP.questsHead[0], sort: "title" },
  { label: SHOP.questsHead[1], sort: "kind" },
  { label: SHOP.questsHead[2], sort: "xp" },
  { label: SHOP.questsHead[3], sort: "sparks" },
  { label: SHOP.questsHead[4], sort: "active" },
];
interface CatalogRow {
  id: string;
  name?: string;
  title?: string;
  type?: string;
  kind?: string;
  tier?: string;
  family?: string;
  description?: string;
  price_sparks?: number;
  rarity?: string;
  active?: boolean;
  secret?: boolean;
  sparks?: number;
  xp?: number;
}

export function ShopPage({
  canWrite,
  canPrice,
  canWriteEvents = false,
}: {
  canWrite: boolean;
  canPrice: boolean;
  /** events.write: edit seasonal event quests listed under Quests. */
  canWriteEvents?: boolean;
}) {
  const [filters, setFilters] = useUrlFilters(SHOP_FILTERS, SHOP_ALLOWED);
  const kind = filters.kind as Kind;
  const pager = usePager();
  const cosmeticSort = useUrlSort(CATALOG_SORT.cosmetics);
  const badgeSort = useUrlSort(CATALOG_SORT.badges);
  const questSort = useUrlSort(CATALOG_SORT.quests);
  const sortQuery = kind === "cosmetics" ? cosmeticSort.query : kind === "badges" ? badgeSort.query : questSort.query;
  const [search, setSearch] = useDebouncedFilter(filters.q, (v) => setFilters({ q: v }, { replace: true }));
  const qs = filters.q ? `q=${encodeURIComponent(filters.q)}&` : "";
  const q = useAdminQuery<AdminPage<CatalogRow>>(
    ["catalog", kind, filters.q, sortQuery, pager.query],
    `/api/admin/catalog/${kind}?${qs}${sortQuery}&${pager.query}`,
    { keepPrevious: true },
  );
  const patch = useAdminAction<{ id: string; patch: Record<string, unknown> }>("PATCH", `/api/admin/catalog/${kind}`);
  const [edit, setEdit] = useState<Record<string, number>>({});
  const num = (id: string, field: string, fallback: number) => edit[`${id}.${field}`] ?? fallback;
  const numCell = (r: CatalogRow, field: "price_sparks" | "sparks" | "xp", allowed: boolean) => (
    <input
      type="number"
      min={0}
      aria-label={SHOP.fieldAria(r.name ?? r.title ?? r.id, field)}
      readOnly={!allowed}
      value={num(r.id, field, r[field] ?? 0)}
      onChange={(e) => setEdit({ ...edit, [`${r.id}.${field}`]: Number(e.target.value) })}
      onBlur={() => {
        const v = edit[`${r.id}.${field}`];
        if (allowed && v !== undefined && v !== r[field]) patch.mutate({ id: r.id, patch: { [field]: v } });
      }}
      className={`${inputCls} num w-24`}
    />
  );
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead title={SHOP.title} purpose={SHOP.intro} />
      <div className="flex flex-wrap items-end gap-3">
        <Tabs<Kind>
          label={SHOP.catalogue}
          value={kind}
          onChange={(k) => setFilters({ kind: k, q: null, sort: null, dir: null })}
          items={SHOP_ALLOWED.kind.map((id) => ({ id: id as Kind, label: SHOP.tabs[id as Kind] }))}
        />
        <Field label={SHOP.search} htmlFor="shop-q">
          <input
            id="shop-q"
            type="search"
            value={search}
            placeholder={SHOP.searchPlaceholder}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} h-11 w-72 max-w-full`}
          />
        </Field>
      </div>
      <p className="text-muted max-w-[760px] text-[13px]">{SHOP.tabIntro[kind]}</p>
      {!canWrite ? (
        <Notice icon="info">{SHOP.readOnly}</Notice>
      ) : (
        kind === "cosmetics" && !canPrice && <Notice icon="info">{SHOP.ownerPrices}</Notice>
      )}
      <div aria-live="polite" className="empty:hidden">
        {patch.error ? (
          <Notice tone="danger" icon="warning">
            {errorText(patch.error)}
          </Notice>
        ) : patch.isSuccess ? (
          <Notice tone="ok" icon="check-circle">
            {SHOP.saved}
          </Notice>
        ) : null}
      </div>
      <Frame q={q}>
        {() =>
          !q.data!.rows.length ? (
            <Empty icon="magnifying-glass">{SHOP.empty}</Empty>
          ) : kind === "cosmetics" ? (
            <Table head={COSMETIC_COLS} sort={cosmeticSort}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-semibold`}>{r.name}</td>
                  <td className={`${td} text-muted text-[13px]`}>{SHOP.types[r.type ?? ""] ?? SHOP.words(r.type ?? "")}</td>
                  <td className={`${td} text-muted text-[13px]`}>{SHOP.rarities[r.rarity ?? ""] ?? SHOP.words(r.rarity ?? "")}</td>
                  <td className={td}>{numCell(r, "price_sparks", canPrice)}</td>
                  <td className={td}>
                    <Toggle
                      on={!!r.active}
                      label={SHOP.inShopAria(r.name ?? r.id)}
                      disabled={!canWrite || patch.isPending}
                      onChange={(v) => patch.mutate({ id: r.id, patch: { active: v } })}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          ) : kind === "badges" ? (
            <Table head={BADGE_COLS} sort={badgeSort}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-muted block text-[13px]">{r.description}</span>
                  </td>
                  <td className={`${td} text-muted text-[13px]`}>{SHOP.words(r.family ?? "")}</td>
                  <td className={`${td} text-[13px]`}>{SHOP.tiers[r.tier ?? ""] ?? SHOP.words(r.tier ?? "")}</td>
                  <td className={td}>{numCell(r, "sparks", canWrite)}</td>
                  <td className={td}>
                    <Toggle
                      on={!!r.secret}
                      label={SHOP.secretAria(r.name ?? r.id)}
                      disabled={!canWrite || patch.isPending}
                      onChange={(v) => patch.mutate({ id: r.id, patch: { secret: v } })}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Table head={QUEST_COLS} sort={questSort}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-semibold`}>{r.title}</td>
                  <td className={`${td} text-muted text-[13px]`}>{SHOP.questKinds[r.kind ?? ""] ?? SHOP.words(r.kind ?? "")}</td>
                  <td className={td}>{numCell(r, "xp", canWrite)}</td>
                  <td className={td}>{numCell(r, "sparks", canWrite)}</td>
                  <td className={td}>
                    <Toggle
                      on={!!r.active}
                      label={SHOP.activeAria(r.title ?? r.id)}
                      disabled={!canWrite || patch.isPending}
                      onChange={(v) => patch.mutate({ id: r.id, patch: { active: v } })}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          )
        }
      </Frame>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
      {kind === "quests" && <EventQuests canWrite={canWriteEvents} />}
    </div>
  );
}

/** How many events the quest catalogue lists: seasonal events are few, so the latest page is all of them in practice. */
const EVENT_QUEST_LIMIT = 100;
const EVENT_TONE: Record<EventStatus, PillTone> = { live: "ok", upcoming: "warn", ended: "neutral" };
const shortWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

interface EventQuestRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  quest: EventQuest;
  status: EventStatus;
}

/**
 * Seasonal events' bonus quests (stored on `events.quest`, not in `quests`), listed under the quest catalogue so
 * every quest players can see is in one place. XP and Sparks are edited inline like catalogue quests and saved
 * through the events API (validated and audited there); the rest of an event is edited on Seasonal events.
 */
function EventQuests({ canWrite }: { canWrite: boolean }) {
  const c = adminCopy.eventQuests;
  const q = useAdminQuery<AdminPage<EventQuestRow>>(["events", "quests"], `/api/admin/events?page=1&pageSize=${EVENT_QUEST_LIMIT}`);
  const save = useAdminAction<{ id: string; quest: EventQuest }>("PATCH", (i) => `/api/admin/events/${i.id}`);
  const [edit, setEdit] = useState<Record<string, number>>({});
  const cell = (e: EventQuestRow, field: "xp" | "sparks", label: "XP" | "Sparks", max: number) => {
    const key = `${e.id}.${field}`;
    return (
      <input
        type="number"
        min={0}
        max={max}
        aria-label={c.fieldLabel(e.quest.title, label)}
        readOnly={!canWrite}
        value={edit[key] ?? e.quest[field]}
        onChange={(ev) => setEdit({ ...edit, [key]: Number(ev.target.value) })}
        onBlur={() => {
          const v = edit[key];
          if (canWrite && v !== undefined && v !== e.quest[field]) save.mutate({ id: e.id, quest: { ...e.quest, [field]: v } });
        }}
        className={`${inputCls} num w-24`}
      />
    );
  };
  return (
    <section aria-labelledby="event-quests" className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="flex flex-col">
          <h2 id="event-quests" className="font-display text-[17px] font-extrabold">
            {c.heading}
          </h2>
          <p className="text-muted text-[13px]">
            {c.intro} {canWrite ? c.editHere : c.readOnly}
          </p>
        </div>
        <Link href="/admin/events" className="text-accent ml-auto flex h-11 items-center text-[13px] font-semibold hover:underline">
          {c.manage}
        </Link>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {save.error ? (
          <Notice tone="danger" icon="warning">
            {errorText(save.error)}
          </Notice>
        ) : save.isSuccess ? (
          <Notice tone="ok" icon="check-circle">
            {SHOP.saved}
          </Notice>
        ) : null}
      </div>
      <Frame q={q}>
        {() =>
          !q.data!.rows.length ? (
            <Empty icon="calendar-blank">{c.empty}</Empty>
          ) : (
            <Table head={[...c.head]} min={860}>
              {q.data!.rows.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} font-semibold`}>{e.quest.title}</td>
                  <td className={td}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{e.name}</span>
                      <StatePill
                        s={{
                          label: adminCopy.events.statuses[e.status],
                          meaning: adminCopy.events.statusMeaning[e.status],
                          tone: EVENT_TONE[e.status],
                        }}
                      />
                    </span>
                  </td>
                  <td className={`${td} num text-muted text-[13px] whitespace-nowrap`}>
                    {c.runs(shortWhen(e.starts_at), shortWhen(e.ends_at))}
                  </td>
                  <td className={`${td} text-muted text-[13px]`}>
                    {c.goal[e.quest.kind](e.quest.n, e.quest.world ? (WORLD_BY_ID[e.quest.world]?.name ?? e.quest.world) : "")}
                  </td>
                  <td className={td}>{cell(e, "xp", "XP", 1000)}</td>
                  <td className={td}>{cell(e, "sparks", "Sparks", 500)}</td>
                </tr>
              ))}
            </Table>
          )
        }
      </Frame>
      {q.data && q.data.total > q.data.rows.length && (
        <p className="num text-muted text-[13px]">{c.latestOnly(q.data.rows.length, q.data.total)}</p>
      )}
    </section>
  );
}

/* ---------------- Activity log (was Audit log) ---------------- */

const AUDIT = adminCopy.audit;
/**
 * URL filters: `auto` is "1" when automatic jobs are shown (hidden by default); `action` and `target` are the
 * technical filters, folded away.
 */
const AUDIT_FILTERS = { actor: "", type: "", from: "", to: "", auto: "", action: "", target: "" } as const;
const AUDIT_ALLOWED = { type: AUDIT_TYPE_IDS as string[], auto: ["1"] };

export function AuditPage() {
  const [{ actor, type, from, to, auto, action, target }, setFilters] = useUrlFilters(AUDIT_FILTERS, AUDIT_ALLOWED);
  const [actionText, setActionText] = useDebouncedFilter(action, (v) => setFilters({ action: v }, { replace: true }));
  const [targetText, setTargetText] = useDebouncedFilter(target, (v) => setFilters({ target: v }, { replace: true }));
  const [advancedOpen] = useState(() => !!(action || target));
  const pager = usePager();
  const sort = useUrlSort(AUDIT_SORT);
  // Asking for automatic jobs (by person or type) shows them whatever the toggle says.
  const showAuto = auto === "1" || actor === "system" || type === "automatic";
  const qs = new URLSearchParams({
    ...(actor && { actor }),
    ...(type && { type }),
    ...(action && { action }),
    ...(target && { target }),
    ...(from && { from }),
    ...(to && { to }),
    ...(!showAuto && { auto: "hide" }),
  });
  const q = useAdminQuery<AdminPage<AuditRow> & { actors: AuditActor[]; players?: Record<string, string> }>(
    ["audit", qs.toString(), sort.query, pager.query],
    `/api/admin/audit?${qs}&${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  const names = { actors: q.data?.actors ?? [], players: q.data?.players ?? {} };
  const filtered = !!(actor || type || from || to || action || target);
  const days = q.data ? byDay(collapseRepeats(q.data.rows)) : [];
  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[20px] font-extrabold tracking-[-0.01em]">{AUDIT.title}</h1>
        <p className="text-muted max-w-[72ch] text-[14px]">{AUDIT.intro}</p>
      </header>

      <section aria-label={AUDIT.filtersLabel} className="bg-surface flex flex-col gap-3 rounded-[16px] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={AUDIT.person} htmlFor="a-actor">
            <select
              id="a-actor"
              value={actor}
              onChange={(e) => setFilters({ actor: e.target.value })}
              className={`${inputCls} h-11 w-full`}
            >
              <option value="">{AUDIT.anyone}</option>
              <option value="system">{AUDIT.automaticOnly}</option>
              {q.data?.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {AUDIT.personOption(a.nickname || a.email || a.id.slice(0, 8), ROLE_LABEL[a.role] ?? a.role)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={AUDIT.type} htmlFor="a-type">
            <select id="a-type" value={type} onChange={(e) => setFilters({ type: e.target.value })} className={`${inputCls} h-11 w-full`}>
              <option value="">{AUDIT.anyType}</option>
              {AUDIT_TYPE_IDS.map((t) => (
                <option key={t} value={t}>
                  {AUDIT.types[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={AUDIT.from} htmlFor="a-from">
            <input
              id="a-from"
              type="date"
              max={to || todayIso()}
              value={from}
              onChange={(e) => setFilters({ from: e.target.value }, { replace: true })}
              className={`${inputCls} h-11 w-full`}
            />
          </Field>
          <Field label={AUDIT.to} htmlFor="a-to">
            <input
              id="a-to"
              type="date"
              min={from || undefined}
              max={todayIso()}
              value={to}
              onChange={(e) => setFilters({ to: e.target.value }, { replace: true })}
              className={`${inputCls} h-11 w-full`}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              checked={showAuto}
              label={AUDIT.showAuto}
              disabled={actor === "system" || type === "automatic"}
              onChange={(v) => setFilters({ auto: v ? "1" : null })}
            />
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold" aria-hidden>
                {AUDIT.showAuto}
              </span>
              <span className="text-muted text-[12px]">{AUDIT.showAutoHint}</span>
            </span>
          </div>
          {filtered && (
            <Btn
              size="lg"
              tone="ghost"
              icon="x"
              onClick={() => setFilters({ actor: null, type: null, from: null, to: null, action: null, target: null })}
            >
              {AUDIT.clear}
            </Btn>
          )}
        </div>
        <details open={advancedOpen} className="text-[13px]">
          <summary className="text-muted w-fit cursor-pointer py-1 font-semibold">{AUDIT.advanced}</summary>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <Field label={AUDIT.actionStarts} htmlFor="a-action">
              <input
                id="a-action"
                value={actionText}
                placeholder={AUDIT.actionPlaceholder}
                onChange={(e) => setActionText(e.target.value.toLowerCase())}
                className={`${inputCls} num h-11 w-48`}
              />
            </Field>
            <Field label={AUDIT.targetContains} htmlFor="a-target">
              <input
                id="a-target"
                value={targetText}
                placeholder={AUDIT.targetPlaceholder}
                onChange={(e) => setTargetText(e.target.value)}
                className={`${inputCls} num h-11 w-48`}
              />
            </Field>
          </div>
        </details>
      </section>

      {q.isPending ? (
        <div className="bg-surface rounded-[16px]">
          <RowsSkeleton rows={8} height={52} />
        </div>
      ) : q.error ? (
        <Notice
          tone="danger"
          icon="warning"
          action={
            <Btn size="sm" icon="arrow-counter-clockwise" onClick={() => q.refetch()}>
              {AUDIT.retry}
            </Btn>
          }
        >
          {AUDIT.loadError} {errorText(q.error)}
        </Notice>
      ) : !days.length ? (
        <div className="bg-surface rounded-[16px]">
          <Empty icon="clock-counter-clockwise">
            <span className="max-w-[48ch]">{filtered ? AUDIT.emptyFiltered : AUDIT.empty}</span>
            {!showAuto && (
              <span>
                {AUDIT.autoHidden}{" "}
                <button
                  type="button"
                  onClick={() => setFilters({ auto: "1" })}
                  className="text-accent min-h-11 font-semibold hover:underline"
                >
                  {AUDIT.showThem}
                </button>
              </span>
            )}
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(({ day, entries }) => (
            <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-2">
              <h2 id={`day-${day}`} className="text-muted text-[13px] font-bold tracking-[0.04em] uppercase">
                {auditDayLabel(day)}
              </h2>
              <ul role="list" className="bg-surface flex flex-col rounded-[16px]">
                {entries.map((e) => (
                  <AuditItem key={e.row.id} entry={e} names={names} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One line of the activity log: a sentence, its time, an optional note, and the raw row folded away. */
function AuditItem({ entry, names }: { entry: AuditEntry; names: AuditNames }) {
  const line = describeEntry(entry, names);
  const r = entry.row;
  const time = auditTime(r.created_at);
  const actor = r.actor_id ? names.actors.find((a) => a.id === r.actor_id) : undefined;
  const roleThen = typeof r.detail?.role === "string" ? r.detail.role : null;
  const tech: [string, ReactNode][] = [
    [AUDIT.tech.action, r.action],
    [AUDIT.tech.target, r.target ?? "—"],
    [AUDIT.tech.when, time.exact],
    [AUDIT.tech.entry, String(r.id)],
  ];
  if (roleThen) tech.splice(2, 0, [AUDIT.tech.role, ROLE_LABEL[roleThen as Role] ?? roleThen]);
  if (entry.rows.length > 1) tech.push([AUDIT.tech.runs, String(entry.rows.length)]);
  return (
    <li className="flex gap-3 border-t border-[var(--line)] px-4 py-3 first:border-0">
      <span
        aria-hidden
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${line.auto ? "bg-surface-raised text-muted" : "text-accent bg-[var(--success-tint)]"}`}
      >
        <Icon name={line.icon} size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-[14px] leading-snug">
            {line.auto ? (
              <>
                <Pill className="mr-1.5 align-[1px]">{AUDIT.automatic}</Pill>
                {sentenceCase(line.text)}
              </>
            ) : (
              <>
                <strong
                  className="font-semibold"
                  title={actor ? [actor.email, ROLE_LABEL[actor.role]].filter(Boolean).join(" · ") : undefined}
                >
                  {line.who}
                </strong>{" "}
                {line.text}
              </>
            )}
          </p>
          <time dateTime={r.created_at} title={time.exact} className="num text-muted shrink-0 text-[12px] whitespace-nowrap">
            {time.text}
          </time>
        </div>
        {line.note && (
          <p className="text-muted text-[13px] break-words">
            {AUDIT.noteLabel} “{line.note}”
          </p>
        )}
        <details className="text-muted text-[12px]">
          <summary className="w-fit cursor-pointer py-1 font-semibold">{AUDIT.techDetails}</summary>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {tech.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>{k}</dt>
                <dd className="num break-all text-[var(--text)]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 font-semibold">{AUDIT.tech.data}</p>
          <pre className="bg-bg num mt-1 max-h-64 overflow-auto rounded-[10px] p-2.5 text-[12px] break-all whitespace-pre-wrap text-[var(--text)]">
            {JSON.stringify(entry.rows.length > 1 ? entry.rows.map((x) => x.detail) : r.detail, null, 2)}
          </pre>
        </details>
      </div>
    </li>
  );
}

/* ---------------- Team ---------------- */

// Team's own imports from the shared console UI (kept with the section, so the pages above stay independent).
import { Ago, Confirm, EmptyState, PageHeader, Section, TechDetails } from "./ui";

const TEAM = adminCopy.team;
const TEAM_FILTERS = { role: "" } as const;
const TEAM_ALLOWED = { role: [...ROLES] };
const TEAM_COLS: HeadCol<(typeof TEAM_SORT.keys)[number]>[] = [
  { label: TEAM.head[0], sort: "email" },
  { label: TEAM.head[1], sort: "role" },
  { label: TEAM.head[2], sort: "totp" },
  { label: TEAM.head[3] },
  { label: TEAM.head[4] },
];

interface TeamRow {
  user_id: string;
  role: Role;
  email: string | null;
  totp_enrolled: boolean;
  disabled_at: string | null;
  last_sign_in_at: string | null;
}

/** A change waiting for the owner's yes: a new role, or access removed or given back. */
type TeamAsk = { row: TeamRow; who: string } & ({ kind: "role"; role: Role } | { kind: "access"; disabled: boolean });

/**
 * Team (owners only, admin overhaul): add someone with a role (the roles explained in plain words), then everyone
 * with access: role, whether they finished their first sign-in, when they last signed in, and access. Role and
 * access changes ask first and say what follows; the server still refuses changes to your own access.
 */
export function TeamPage() {
  const pager = usePager();
  const sort = useUrlSort(TEAM_SORT);
  const [{ role: roleFilter }, setFilters] = useUrlFilters(TEAM_FILTERS, TEAM_ALLOWED);
  const q = useAdminQuery<AdminPage<TeamRow> & { me: string }>(
    ["team", roleFilter, sort.query, pager.query],
    `/api/admin/team?${roleFilter ? `role=${roleFilter}&` : ""}${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  const add = useAdminAction<{ email: string; role: Role }, { resetSent: boolean }>("POST", "/api/admin/team");
  const patch = useAdminAction<{ id: string; role?: Role; disabled?: boolean }>("PATCH", (i) => `/api/admin/team/${i.id}`);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("content_editor");
  const [addedEmail, setAddedEmail] = useState("");
  const [ask, setAsk] = useState<TeamAsk | null>(null);
  const [done, setDone] = useState("");

  const confirm = () => {
    if (!ask) return;
    const { row, who } = ask;
    const input = ask.kind === "role" ? { id: row.user_id, role: ask.role } : { id: row.user_id, disabled: ask.disabled };
    const message =
      ask.kind === "role" ? TEAM.roleChanged(who, ROLE_LABEL[ask.role]) : ask.disabled ? TEAM.accessRemoved(who) : TEAM.accessRestored(who);
    setDone("");
    patch.mutate(input, { onSuccess: () => setDone(message), onSettled: () => setAsk(null) });
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <PageHeader title={TEAM.title} purpose={TEAM.intro} />

      <div aria-live="polite" className="empty:hidden">
        {done && (
          <Notice tone="ok" icon="check-circle">
            {done}
          </Notice>
        )}
        {patch.error && <Notice tone="danger">{errorText(patch.error)}</Notice>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section id="team-add" title={TEAM.addTitle} description={TEAM.addIntro}>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const who = email.trim();
              add.mutate(
                { email: who, role },
                {
                  onSuccess: () => {
                    setAddedEmail(who);
                    setEmail("");
                    pager.reset();
                  },
                },
              );
            }}
          >
            <div className="min-w-0 flex-[1_1_240px]">
              <Field label={TEAM.email} htmlFor="t-email">
                <input
                  id="t-email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder={TEAM.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputCls} h-11 w-full`}
                />
              </Field>
            </div>
            <div className="min-w-0 flex-[1_1_180px]">
              <Field label={TEAM.role} htmlFor="t-role">
                <select id="t-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputCls} h-11 w-full`}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Btn type="submit" tone="primary" size="lg" icon="user-plus" disabled={add.isPending}>
              {add.isPending ? TEAM.adding : TEAM.add}
            </Btn>
            <p className="text-muted w-full text-[13px] leading-[1.4]">
              <span className="text-text font-semibold">{ROLE_LABEL[role]}:</span> {TEAM.roles[role]}
            </p>
          </form>
          <div aria-live="polite" className="empty:hidden">
            {add.error ? (
              <Notice tone="danger">{errorText(add.error)}</Notice>
            ) : add.data ? (
              <Notice tone="ok" icon="check-circle">
                {TEAM.added(addedEmail, add.data.resetSent)}
              </Notice>
            ) : null}
          </div>
        </Section>

        {/* Reference, folded away until needed (owner request). */}
        <details id="team-roles" className="group/roles bg-surface self-start rounded-[16px]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 rounded-[16px] px-4 py-3 md:px-5 [&::-webkit-details-marker]:hidden">
            <Icon name="info" size={18} className="text-muted" />
            <span className="flex-1 text-[15px] font-bold">{TEAM.rolesTitle}</span>
            <Icon name="caret-down" size={16} className="text-muted transition-transform duration-150 group-open/roles:rotate-180" />
          </summary>
          <ul className="border-line flex flex-col gap-2.5 border-t px-4 py-3 md:px-5">
            {ROLES.map((r) => (
              <li key={r} className="flex flex-col gap-0.5 text-[14px]">
                <span className="font-semibold">{ROLE_LABEL[r]}</span>
                <span className="text-muted text-[13px] leading-[1.4]">{TEAM.roles[r]}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <Section
        id="team-list"
        title={TEAM.listTitle}
        aside={
          <Field label={TEAM.roleFilter} htmlFor="t-filter">
            <select
              id="t-filter"
              value={roleFilter}
              onChange={(e) => setFilters({ role: e.target.value })}
              className={`${inputCls} h-11 w-48`}
            >
              <option value="">{TEAM.anyRole}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        }
      >
        <div className="-mx-4 sm:-mx-5">
          <Frame q={q}>
            {() =>
              q.data!.rows.length === 0 ? (
                <EmptyState icon="users-three" title={roleFilter ? TEAM.empty : TEAM.emptyAll} />
              ) : (
                <Table head={TEAM_COLS} sort={sort} min={760}>
                  {q.data!.rows.map((a) => (
                    <TeamRowView key={a.user_id} a={a} self={a.user_id === q.data!.me} busy={patch.isPending} onAsk={setAsk} />
                  ))}
                </Table>
              )
            }
          </Frame>
        </div>
        {q.data && q.data.total > 0 && <Pagination pager={pager} total={q.data.total} />}
      </Section>

      <Confirm
        open={!!ask}
        busy={patch.isPending}
        danger={ask?.kind === "access" && ask.disabled}
        title={
          !ask
            ? ""
            : ask.kind === "role"
              ? TEAM.confirmRoleTitle(ask.who, ROLE_LABEL[ask.role])
              : ask.disabled
                ? TEAM.confirmRemoveTitle(ask.who)
                : TEAM.confirmRestoreTitle(ask.who)
        }
        body={
          !ask
            ? ""
            : ask.kind === "role"
              ? TEAM.confirmRoleBody(ROLE_LABEL[ask.role], TEAM.roles[ask.role])
              : ask.disabled
                ? TEAM.confirmRemoveBody
                : TEAM.confirmRestoreBody(ROLE_LABEL[ask.row.role])
        }
        confirmLabel={!ask ? "" : ask.kind === "role" ? TEAM.changeRole : ask.disabled ? TEAM.remove : TEAM.restore}
        onCancel={() => setAsk(null)}
        onConfirm={confirm}
      />
    </div>
  );
}

function TeamRowView({ a, self, busy, onAsk }: { a: TeamRow; self: boolean; busy: boolean; onAsk: (ask: TeamAsk) => void }) {
  const who = a.email ?? TEAM.noEmail;
  const locked = self ? TEAM.selfLocked : undefined;
  return (
    <tr className={a.disabled_at ? "text-muted" : undefined}>
      <td className={td}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 font-semibold break-all">
            {who}
            {self && <Pill tone="info">{TEAM.you}</Pill>}
          </span>
          <TechDetails summary={TEAM.idLabel} className="text-[12px]">
            {a.user_id}
          </TechDetails>
        </div>
      </td>
      <td className={td}>
        <select
          aria-label={TEAM.roleAria(who)}
          title={locked}
          value={a.role}
          disabled={self || busy}
          onChange={(e) => onAsk({ kind: "role", role: e.target.value as Role, row: a, who })}
          className={`${inputCls} h-11 w-44`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </td>
      <td className={td}>
        {a.totp_enrolled ? (
          <Pill tone="ok">{TEAM.firstDone}</Pill>
        ) : (
          <Pill tone="warn" title={TEAM.firstNotYetHint}>
            {TEAM.firstNotYet}
          </Pill>
        )}
      </td>
      <td className={`${td} text-[13px]`}>
        <Ago iso={a.last_sign_in_at} />
      </td>
      <td className={td}>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={a.disabled_at ? "danger" : "ok"} dot>
            {a.disabled_at ? TEAM.removed : TEAM.canSignIn}
          </Pill>
          {self ? (
            <span className="text-muted text-[12px]">{TEAM.selfLocked}</span>
          ) : (
            <Btn
              size="sm"
              tone={a.disabled_at ? "secondary" : "ghost"}
              icon={a.disabled_at ? "user-plus" : "user-minus"}
              disabled={busy}
              className="h-11 sm:h-9"
              onClick={() => onAsk({ kind: "access", disabled: !a.disabled_at, row: a, who })}
            >
              {a.disabled_at ? TEAM.restore : TEAM.remove}
            </Btn>
          )}
        </div>
      </td>
    </tr>
  );
}
