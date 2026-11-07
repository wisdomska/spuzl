"use client";

/** Smaller admin tools: schools, shop and events (FR-AD-04), feature flags (FR-AD-07), audit log (FR-AD-08), team. */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { age, todayIso } from "@/lib/admin/dates";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/admin/roles";
import { AUDIT_SORT, CATALOG_SORT, TEAM_SORT } from "@/lib/admin/sorting";
import { WORLD_BY_ID } from "@/lib/catalog";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import type { EventQuest, EventStatus } from "@/lib/events";
import { SCHOOL_KINDS, type SchoolKind, type SchoolLeagueRow } from "@/lib/schools";
import { Pagination, usePager } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { useDebouncedFilter, useUrlFilters, useUrlSort, type UrlSort } from "./useUrlFilters";
import { Btn, Empty, Field, Notice, PageTitle, Pill, RowsSkeleton, Tabs, inputCls, type PillTone } from "./ui";

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
    <div className="bg-surface overflow-x-auto rounded-[12px]">
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

/* ---------------- Schools ---------------- */

const SCH = adminCopy.schools;

export function SchoolsPage({ canWrite }: { canWrite: boolean }) {
  const pager = usePager();
  const q = useAdminQuery<
    AdminPage<{
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      code: string;
      kind?: SchoolKind;
      verified: boolean;
      players: number;
      created_at: string;
    }>
  >(["schools", pager.query], `/api/admin/schools?${pager.query}`, { keepPrevious: true });
  const act = useAdminAction<{ id: string; decision: "verify" | "unverify" }>("POST", (i) => `/api/admin/schools/${i.id}`);
  const create = useAdminAction<SchoolDraft>("POST", "/api/admin/schools");
  const edit = useAdminAction<SchoolDraft & { id: string }>("PATCH", (i) => `/api/admin/schools/${i.id}`);
  const [form, setForm] = useState<{ id: string | null; draft: SchoolDraft } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const error = act.error ?? create.error ?? edit.error;
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title={SCH.title}
        aside={
          canWrite && !form ? (
            <Btn
              tone="primary"
              icon="plus"
              size="lg"
              onClick={() => (setDone(null), setForm({ id: null, draft: { name: "", city: "", country: "Ghana", kind: "school" } }))}
            >
              {SCH.add}
            </Btn>
          ) : undefined
        }
      >
        <span className="text-muted text-[14px]">{SCH.intro}</span>
      </PageTitle>
      {error && <Notice tone="danger">{errorText(error)}</Notice>}
      {done && (
        <Notice tone="ok" icon="check-circle">
          {done}
        </Notice>
      )}
      {form && (
        <SchoolForm
          key={form.id ?? "new"}
          initial={form.draft}
          isNew={!form.id}
          busy={create.isPending || edit.isPending}
          onCancel={() => setForm(null)}
          onSave={(d) => {
            const body = { ...d, city: d.city || null, country: d.country || null };
            const after = (msg: string) => () => (setForm(null), setDone(msg));
            if (form.id) edit.mutate({ ...body, id: form.id } as SchoolDraft & { id: string }, { onSuccess: after(SCH.saved(d.name)) });
            else create.mutate(body as SchoolDraft, { onSuccess: after(SCH.created(d.name)) });
          }}
        />
      )}
      <Frame q={q}>
        {() =>
          !q.data!.rows.length ? (
            <Empty icon="graduation-cap">{SCH.empty}</Empty>
          ) : (
            <Table head={[...SCH.head]}>
              {q.data!.rows.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} font-semibold`}>
                    {s.name}
                    <span className="text-muted block text-[12px] font-medium">{SCH.kinds[s.kind ?? "school"]}</span>
                  </td>
                  <td className={`${td} text-muted text-[13px]`}>{[s.city, s.country].filter(Boolean).join(", ")}</td>
                  <td className={`${td} num text-muted text-[13px]`}>{s.code}</td>
                  <td className={`${td} num text-[13px]`}>{s.players}</td>
                  <td className={`${td} num text-muted text-[13px]`}>{age(s.created_at)}</td>
                  <td className={td}>{s.verified ? <Pill tone="ok">{SCH.verified}</Pill> : <Pill tone="warn">{SCH.pending}</Pill>}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {canWrite && (
                      <Btn
                        size="sm"
                        tone="ghost"
                        icon="pencil-simple"
                        aria-label={SCH.editAria(s.name)}
                        onClick={() => (
                          setDone(null),
                          setForm({
                            id: s.id,
                            draft: { name: s.name, city: s.city ?? "", country: s.country ?? "", kind: s.kind ?? "school" },
                          })
                        )}
                      />
                    )}
                    {canWrite && (
                      <Btn
                        size="sm"
                        tone={s.verified ? "ghost" : "primary"}
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: s.id, decision: s.verified ? "unverify" : "verify" })}
                      >
                        {s.verified ? SCH.withdraw : SCH.verify}
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )
        }
      </Frame>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
      <SchoolLeagueTable />
    </div>
  );
}

interface SchoolDraft {
  name: string;
  city: string;
  country: string;
  kind: SchoolKind;
}

/** R2-P5: add or edit a school or campus. The server validates and audits (school.create, school.update). */
function SchoolForm({
  initial,
  isNew,
  busy,
  onSave,
  onCancel,
}: {
  initial: SchoolDraft;
  isNew: boolean;
  busy: boolean;
  onSave: (d: SchoolDraft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = <K extends keyof SchoolDraft>(k: K, v: SchoolDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="bg-surface flex flex-col gap-3 rounded-[12px] p-4"
      aria-label={isNew ? SCH.addTitle : SCH.editTitle(initial.name)}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={SCH.name} htmlFor="sc-name">
          <input
            id="sc-name"
            required
            minLength={3}
            maxLength={80}
            value={d.name}
            placeholder={SCH.namePlaceholder}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={SCH.kind} htmlFor="sc-kind">
          <select id="sc-kind" value={d.kind} onChange={(e) => set("kind", e.target.value as SchoolKind)} className={inputCls}>
            {SCHOOL_KINDS.map((k) => (
              <option key={k} value={k}>
                {SCH.kinds[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={SCH.city} htmlFor="sc-city">
          <input id="sc-city" maxLength={60} value={d.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
        </Field>
        <Field label={SCH.country} htmlFor="sc-country">
          <input id="sc-country" maxLength={60} value={d.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Btn type="submit" tone="primary" size="lg" icon="check" disabled={busy || d.name.trim().length < 3}>
          {isNew ? SCH.create : SCH.save}
        </Btn>
        <Btn size="lg" onClick={onCancel}>
          {SCH.cancel}
        </Btn>
      </div>
    </form>
  );
}

/** The last eight Mondays (GMT), newest first. */
function recentMondays(n = 8): string[] {
  const d = new Date();
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return Array.from({ length: n }, (_, i) => new Date(monday.getTime() - i * 7 * 86_400_000).toISOString().slice(0, 10));
}

/** R2-P5: the weekly school-vs-school table with an audited CSV export (POST /api/admin/schools/league). */
function SchoolLeagueTable() {
  const weeks = recentMondays();
  const [week, setWeek] = useState(weeks[0]);
  const settings = useAdminQuery<{ rows: { key: string; value: unknown }[] }>(["game-settings"], "/api/admin/settings");
  const on = settings.data?.rows.find((r) => r.key === "features.schoolLeagues")?.value === true;
  const min = Number(settings.data?.rows.find((r) => r.key === "schoolLeagues.minPlayers")?.value ?? 3);
  const q = useAdminQuery<{ week: string; metric: string; rows: SchoolLeagueRow[] }>(
    ["school-league", week],
    `/api/admin/schools/league?week=${week}`,
    { keepPrevious: true },
  );
  const exportCsv = useAdminAction<{ week: string }, { filename: string; csv: string }>("POST", "/api/admin/schools/league");
  const save = () =>
    exportCsv.mutate(
      { week },
      {
        onSuccess: (r) => {
          const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = r.filename;
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        },
      },
    );
  return (
    <section aria-labelledby="school-league" className="flex flex-col gap-2.5 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="school-league" className="text-[17px] font-bold">
          {SCH.leagueTitle}
        </h2>
        <label className="text-muted flex items-center gap-2 text-[13px] font-semibold">
          {SCH.week}
          <select value={week} onChange={(e) => setWeek(e.target.value)} className={`${inputCls} h-11 w-40`}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <Btn size="lg" tone="ghost" icon="download-simple" onClick={save} disabled={exportCsv.isPending} aria-label={SCH.csvAria}>
          {SCH.csv}
        </Btn>
      </div>
      <p className="text-muted text-[13px]">
        {SCH.leagueIntro(on)} {q.data ? SCH.metric(q.data.metric) : ""}
      </p>
      {exportCsv.error && <Notice tone="danger">{errorText(exportCsv.error)}</Notice>}
      <Frame q={q}>
        {() =>
          !q.data!.rows.length ? (
            <Empty icon="graduation-cap">{SCH.leagueEmpty(min)}</Empty>
          ) : (
            <Table head={[...SCH.leagueHead]}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} num font-semibold`}>{r.rank}</td>
                  <td className={`${td} font-semibold`}>
                    {r.name}
                    {r.city && <span className="text-muted block text-[12px] font-medium">{r.city}</span>}
                  </td>
                  <td className={`${td} text-muted text-[13px]`}>{SCH.kinds[r.kind]}</td>
                  <td className={`${td} num`}>{r.active}</td>
                  <td className={`${td} num`}>{r.total}</td>
                  <td className={`${td} num font-semibold`}>{r.average}</td>
                </tr>
              ))}
            </Table>
          )
        }
      </Frame>
    </section>
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
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title={SHOP.title}
        aside={
          <Tabs<Kind>
            label={SHOP.catalogue}
            value={kind}
            onChange={(k) => setFilters({ kind: k, q: null, sort: null, dir: null })}
            items={SHOP_ALLOWED.kind.map((id) => ({ id: id as Kind, label: SHOP.tabs[id as Kind] }))}
          />
        }
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
      {kind === "cosmetics" && !canPrice && <Notice icon="info">{SHOP.ownerPrices}</Notice>}
      {patch.error && <Notice tone="danger">{errorText(patch.error)}</Notice>}
      {patch.isSuccess && (
        <Notice tone="ok" icon="check-circle">
          {adminCopy.common.savedAndLogged}
        </Notice>
      )}
      <Frame q={q}>
        {() =>
          kind === "cosmetics" ? (
            <Table head={COSMETIC_COLS} sort={cosmeticSort}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-semibold`}>{r.name}</td>
                  <td className={`${td} text-muted text-[13px]`}>{r.type?.replace("_", " ")}</td>
                  <td className={`${td} text-muted text-[13px]`}>{r.rarity}</td>
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
                  <td className={`${td} text-muted text-[13px]`}>{r.family}</td>
                  <td className={`${td} text-[13px]`}>{r.tier}</td>
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
                  <td className={`${td} text-muted text-[13px]`}>{r.kind}</td>
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
      {save.error && <Notice tone="danger">{errorText(save.error)}</Notice>}
      {save.isSuccess && (
        <Notice tone="ok" icon="check-circle">
          {adminCopy.common.savedAndLogged}
        </Notice>
      )}
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
                      <Pill tone={EVENT_TONE[e.status]}>{e.status}</Pill>
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

/* ---------------- Feature flags ---------------- */

const FLAGS = adminCopy.flags;

export function FlagsPage({ canWrite }: { canWrite: boolean }) {
  const pager = usePager();
  const q = useAdminQuery<AdminPage<{ key: string; enabled: boolean; payload: Record<string, unknown>; updated_at: string }>>(
    ["flags", pager.query],
    `/api/admin/flags?${pager.query}`,
    { keepPrevious: true },
  );
  const put = useAdminAction<{ key: string; enabled: boolean; payload?: Record<string, unknown> }>("PUT", "/api/admin/flags");
  const [key, setKey] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title={FLAGS.title}>
        <span className="text-muted text-[14px]">{FLAGS.intro}</span>
      </PageTitle>
      {put.error && <Notice tone="danger">{errorText(put.error)}</Notice>}
      {added && (
        <Notice tone="ok" icon="check-circle">
          {FLAGS.added(added)}
        </Notice>
      )}
      {canWrite && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            put.mutate({ key, enabled: false }, { onSuccess: () => (setAdded(key), setKey("")) });
          }}
        >
          <Field label={FLAGS.newKey} htmlFor="flagkey">
            <input
              id="flagkey"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder={FLAGS.keyPlaceholder}
              pattern="[a-z0-9_.:\-]{2,60}"
              required
              className={`${inputCls} w-72`}
            />
          </Field>
          <Btn type="submit" icon="plus" disabled={put.isPending}>
            {FLAGS.add}
          </Btn>
        </form>
      )}
      <Frame q={q}>
        {() => (
          <Table head={[...FLAGS.head]}>
            {q.data!.rows.map((f) => (
              <tr key={f.key}>
                <td className={`${td} num font-semibold`}>{f.key}</td>
                <td className={td}>
                  <Toggle
                    on={f.enabled}
                    label={f.key}
                    disabled={!canWrite || put.isPending}
                    onChange={(v) => put.mutate({ key: f.key, enabled: v })}
                  />
                </td>
                <td className={td}>
                  <PayloadCell flag={f} canWrite={canWrite} onSave={(payload) => put.mutate({ key: f.key, enabled: f.enabled, payload })} />
                </td>
                <td className={`${td} num text-muted text-[13px]`}>{age(f.updated_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Frame>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}

function PayloadCell({
  flag,
  canWrite,
  onSave,
}: {
  flag: { key: string; payload: Record<string, unknown> };
  canWrite: boolean;
  onSave: (p: Record<string, unknown>) => void;
}) {
  const initial = JSON.stringify(flag.payload ?? {});
  const [text, setText] = useState(initial);
  let valid = true;
  try {
    const v = JSON.parse(text);
    valid = !!v && typeof v === "object" && !Array.isArray(v);
  } catch {
    valid = false;
  }
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={FLAGS.payloadAria(flag.key)}
        value={text}
        readOnly={!canWrite}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={!valid}
        className={`${inputCls} num min-w-[200px] text-[13px] ${valid ? "" : "shadow-[inset_0_0_0_2px_var(--danger)]"}`}
      />
      {canWrite && text !== initial && (
        <Btn size="sm" disabled={!valid} onClick={() => onSave(JSON.parse(text))}>
          {FLAGS.save}
        </Btn>
      )}
    </div>
  );
}

/* ---------------- Audit log ---------------- */

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

const AUDIT = adminCopy.audit;
const AUDIT_FILTERS = { actor: "", action: "", target: "", from: "", to: "" } as const;
const AUDIT_COLS: HeadCol<(typeof AUDIT_SORT.keys)[number]>[] = [
  { label: AUDIT.head[0], sort: "created_at" },
  { label: AUDIT.head[1] },
  { label: AUDIT.head[2], sort: "action" },
  { label: AUDIT.head[3], sort: "target" },
  { label: AUDIT.head[4] },
];

export function AuditPage() {
  const [{ actor, action, target, from, to }, setFilters] = useUrlFilters(AUDIT_FILTERS);
  const [actionText, setActionText] = useDebouncedFilter(action, (v) => setFilters({ action: v }, { replace: true }));
  const [targetText, setTargetText] = useDebouncedFilter(target, (v) => setFilters({ target: v }, { replace: true }));
  const pager = usePager();
  const sort = useUrlSort(AUDIT_SORT);
  const qs = new URLSearchParams({
    ...(actor && { actor }),
    ...(action && { action }),
    ...(target && { target }),
    ...(from && { from }),
    ...(to && { to }),
  });
  const q = useAdminQuery<AdminPage<AuditRow> & { actors: { id: string; email: string | null; role: Role }[] }>(
    ["audit", qs.toString(), sort.query, pager.query],
    `/api/admin/audit?${qs}${qs.size ? "&" : ""}${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  const who = (id: string | null) => (id ? (q.data?.actors.find((a) => a.id === id)?.email ?? id.slice(0, 8)) : AUDIT.systemShort);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title={AUDIT.title}>
        <span className="text-muted text-[14px]">{AUDIT.intro}</span>
      </PageTitle>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={AUDIT.who} htmlFor="a-actor">
          <select id="a-actor" value={actor} onChange={(e) => setFilters({ actor: e.target.value })} className={`${inputCls} w-56`}>
            <option value="">{AUDIT.anyone}</option>
            <option value="system">{AUDIT.system}</option>
            {q.data?.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email ?? a.id.slice(0, 8)} ({ROLE_LABEL[a.role]})
              </option>
            ))}
          </select>
        </Field>
        <Field label={AUDIT.actionStarts} htmlFor="a-action">
          <input
            id="a-action"
            value={actionText}
            placeholder={AUDIT.actionPlaceholder}
            onChange={(e) => setActionText(e.target.value.toLowerCase())}
            className={`${inputCls} w-40`}
          />
        </Field>
        <Field label={AUDIT.targetContains} htmlFor="a-target">
          <input
            id="a-target"
            value={targetText}
            placeholder={AUDIT.targetPlaceholder}
            onChange={(e) => setTargetText(e.target.value)}
            className={`${inputCls} w-40`}
          />
        </Field>
        <Field label={AUDIT.from} htmlFor="a-from">
          <input
            id="a-from"
            type="date"
            max={todayIso()}
            value={from}
            onChange={(e) => setFilters({ from: e.target.value }, { replace: true })}
            className={`${inputCls} w-40`}
          />
        </Field>
        <Field label={AUDIT.to} htmlFor="a-to">
          <input
            id="a-to"
            type="date"
            max={todayIso()}
            value={to}
            onChange={(e) => setFilters({ to: e.target.value }, { replace: true })}
            className={`${inputCls} w-40`}
          />
        </Field>
      </div>
      <Frame q={q}>
        {() =>
          !q.data!.rows.length ? (
            <Empty icon="clock-counter-clockwise">{AUDIT.empty}</Empty>
          ) : (
            <Table head={AUDIT_COLS} sort={sort} min={860}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} num text-muted text-[13px] whitespace-nowrap`}>{r.created_at.slice(0, 16).replace("T", " ")}</td>
                  <td className={`${td} max-w-[200px] truncate text-[13px]`}>{who(r.actor_id)}</td>
                  <td className={`${td} num text-[13px] font-semibold`}>{r.action}</td>
                  <td className={`${td} num text-muted max-w-[200px] truncate text-[13px]`}>{r.target}</td>
                  <td className={`${td} num text-muted max-w-[360px] text-[12px]`}>
                    <span className="line-clamp-2 break-all">{JSON.stringify(r.detail)}</span>
                  </td>
                </tr>
              ))}
            </Table>
          )
        }
      </Frame>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}

/* ---------------- Team ---------------- */

const TEAM = adminCopy.team;
const TEAM_FILTERS = { role: "" } as const;
const TEAM_ALLOWED = { role: [...ROLES] };
const TEAM_COLS: HeadCol<(typeof TEAM_SORT.keys)[number]>[] = [
  { label: "Admin", sort: "email" },
  { label: "Role", sort: "role" },
  { label: "Email code", sort: "totp" },
  { label: "Last sign-in" },
  { label: "Access" },
];

export function TeamPage() {
  const pager = usePager();
  const sort = useUrlSort(TEAM_SORT);
  const [{ role: roleFilter }, setFilters] = useUrlFilters(TEAM_FILTERS, TEAM_ALLOWED);
  const q = useAdminQuery<
    AdminPage<{
      user_id: string;
      role: Role;
      email: string | null;
      totp_enrolled: boolean;
      disabled_at: string | null;
      last_sign_in_at: string | null;
    }> & { me: string }
  >(
    ["team", roleFilter, sort.query, pager.query],
    `/api/admin/team?${roleFilter ? `role=${roleFilter}&` : ""}${sort.query}&${pager.query}`,
    {
      keepPrevious: true,
    },
  );
  const add = useAdminAction<{ email: string; role: Role }, { resetSent: boolean }>("POST", "/api/admin/team");
  const patch = useAdminAction<{ id: string; role?: Role; disabled?: boolean }>("PATCH", (i) => `/api/admin/team/${i.id}`);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("content_editor");
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title={TEAM.title}>
        <span className="text-muted text-[14px]">{TEAM.intro}</span>
      </PageTitle>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ email, role }, { onSuccess: () => (setEmail(""), pager.reset()) });
        }}
      >
        <Field label={TEAM.email} htmlFor="t-email">
          <input
            id="t-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls} w-72`}
          />
        </Field>
        <Field label={TEAM.role} htmlFor="t-role">
          <select id="t-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputCls} w-48`}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Btn type="submit" tone="primary" icon="user-plus" disabled={add.isPending}>
          {TEAM.add}
        </Btn>
      </form>
      {(add.error || patch.error) && <Notice tone="danger">{errorText(add.error ?? patch.error)}</Notice>}
      {add.data && (
        <Notice tone="ok" icon="check-circle">
          {TEAM.added(add.data.resetSent)}
        </Notice>
      )}
      <Field label={adminCopy.team.roleFilter} htmlFor="t-filter">
        <select id="t-filter" value={roleFilter} onChange={(e) => setFilters({ role: e.target.value })} className={`${inputCls} h-11 w-48`}>
          <option value="">{adminCopy.team.anyRole}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>
      <Frame q={q}>
        {() => (
          <Table head={TEAM_COLS} sort={sort}>
            {q.data!.rows.map((a) => {
              const self = a.user_id === q.data!.me;
              return (
                <tr key={a.user_id}>
                  <td className={`${td} font-semibold`}>
                    {a.email ?? a.user_id.slice(0, 8)}
                    {self && <span className="text-muted text-[13px] font-medium"> {TEAM.you}</span>}
                  </td>
                  <td className={td}>
                    <select
                      aria-label={TEAM.roleAria(a.email ?? a.user_id.slice(0, 8))}
                      value={a.role}
                      disabled={self || patch.isPending}
                      onChange={(e) => patch.mutate({ id: a.user_id, role: e.target.value as Role })}
                      className={`${inputCls} w-44`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    {a.totp_enrolled ? <Pill tone="ok">{TEAM.totpOn}</Pill> : <Pill tone="warn">{TEAM.totpNotYet}</Pill>}
                  </td>
                  <td className={`${td} num text-muted text-[13px]`}>
                    {a.last_sign_in_at ? TEAM.ago(age(a.last_sign_in_at)) : TEAM.never}
                  </td>
                  <td className={td}>
                    {self ? (
                      <span className="text-muted text-[13px]">{TEAM.active}</span>
                    ) : (
                      <Btn
                        size="sm"
                        tone={a.disabled_at ? "secondary" : "ghost"}
                        icon={a.disabled_at ? "user-plus" : "user-minus"}
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: a.user_id, disabled: !a.disabled_at })}
                      >
                        {a.disabled_at ? TEAM.enable : TEAM.disable}
                      </Btn>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Frame>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}
