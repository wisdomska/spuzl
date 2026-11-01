"use client";

/** Smaller admin tools: schools, shop and events (FR-AD-04), feature flags (FR-AD-07), audit log (FR-AD-08), team. */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { age, todayIso } from "@/lib/admin/dates";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/admin/roles";
import { WORLD_BY_ID } from "@/lib/catalog";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import type { EventQuest, EventStatus } from "@/lib/events";
import { Pagination, usePager } from "./Pagination";
import { useDebouncedFilter, useUrlFilters } from "./useUrlFilters";
import { Btn, Empty, Field, Notice, PageTitle, Pill, RowsSkeleton, Tabs, inputCls, type PillTone } from "./ui";

function Table({ head, children, min = 640 }: { head: string[]; children: ReactNode; min?: number }) {
  return (
    <table className="w-full border-collapse text-[14px]" style={{ minWidth: min }}>
      <thead>
        <tr className="bg-surface-raised num text-muted text-left text-[12px]">
          {head.map((h) => (
            <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
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
      {on ? "On" : "Off"}
    </button>
  );
}

/* ---------------- Schools ---------------- */

export function SchoolsPage({ canWrite }: { canWrite: boolean }) {
  const pager = usePager();
  const q = useAdminQuery<
    AdminPage<{
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      code: string;
      verified: boolean;
      players: number;
      created_at: string;
    }>
  >(["schools", pager.query], `/api/admin/schools?${pager.query}`, { keepPrevious: true });
  const act = useAdminAction<{ id: string; decision: "verify" | "unverify" }>("POST", (i) => `/api/admin/schools/${i.id}`);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title="Schools">
        <span className="text-muted text-[14px]">Verified school names show on boards and School Cup.</span>
      </PageTitle>
      {act.error && <Notice tone="danger">{errorText(act.error)}</Notice>}
      <Frame q={q}>
        {() =>
          !q.data!.rows.length ? (
            <Empty icon="graduation-cap">No schools yet.</Empty>
          ) : (
            <Table head={["School", "Place", "Code", "Players", "Added", "Status", ""]}>
              {q.data!.rows.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} font-semibold`}>{s.name}</td>
                  <td className={`${td} text-muted text-[13px]`}>{[s.city, s.country].filter(Boolean).join(", ")}</td>
                  <td className={`${td} num text-muted text-[13px]`}>{s.code}</td>
                  <td className={`${td} num text-[13px]`}>{s.players}</td>
                  <td className={`${td} num text-muted text-[13px]`}>{age(s.created_at)}</td>
                  <td className={td}>{s.verified ? <Pill tone="ok">verified</Pill> : <Pill tone="warn">pending</Pill>}</td>
                  <td className={`${td} text-right`}>
                    {canWrite && (
                      <Btn
                        size="sm"
                        tone={s.verified ? "ghost" : "primary"}
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: s.id, decision: s.verified ? "unverify" : "verify" })}
                      >
                        {s.verified ? "Withdraw" : "Verify"}
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
    </div>
  );
}

/* ---------------- Shop and events ---------------- */

type Kind = "cosmetics" | "badges" | "quests";
const SHOP_FILTERS = { kind: "cosmetics" } as const;
const SHOP_ALLOWED = { kind: ["cosmetics", "badges", "quests"] };
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
  const q = useAdminQuery<AdminPage<CatalogRow>>(["catalog", kind, pager.query], `/api/admin/catalog/${kind}?${pager.query}`, {
    keepPrevious: true,
  });
  const patch = useAdminAction<{ id: string; patch: Record<string, unknown> }>("PATCH", `/api/admin/catalog/${kind}`);
  const [edit, setEdit] = useState<Record<string, number>>({});
  const num = (id: string, field: string, fallback: number) => edit[`${id}.${field}`] ?? fallback;
  const numCell = (r: CatalogRow, field: "price_sparks" | "sparks" | "xp", allowed: boolean) => (
    <input
      type="number"
      min={0}
      aria-label={`${r.name ?? r.title} ${field.replace("_", " ")}`}
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
        title="Shop and events"
        aside={
          <Tabs<Kind>
            label="Catalogue"
            value={kind}
            onChange={(k) => setFilters({ kind: k })}
            items={[
              { id: "cosmetics", label: "Cosmetics and prices" },
              { id: "badges", label: "Badges" },
              { id: "quests", label: "Quests" },
            ]}
          />
        }
      />
      {kind === "cosmetics" && !canPrice && <Notice icon="info">Only the owner changes Sparks prices.</Notice>}
      {patch.error && <Notice tone="danger">{errorText(patch.error)}</Notice>}
      {patch.isSuccess && (
        <Notice tone="ok" icon="check-circle">
          Saved and logged.
        </Notice>
      )}
      <Frame q={q}>
        {() =>
          kind === "cosmetics" ? (
            <Table head={["Item", "Type", "Rarity", "Price (Sparks)", "In shop"]}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-semibold`}>{r.name}</td>
                  <td className={`${td} text-muted text-[13px]`}>{r.type?.replace("_", " ")}</td>
                  <td className={`${td} text-muted text-[13px]`}>{r.rarity}</td>
                  <td className={td}>{numCell(r, "price_sparks", canPrice)}</td>
                  <td className={td}>
                    <Toggle
                      on={!!r.active}
                      label={`${r.name} in shop`}
                      disabled={!canWrite || patch.isPending}
                      onChange={(v) => patch.mutate({ id: r.id, patch: { active: v } })}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          ) : kind === "badges" ? (
            <Table head={["Badge", "Family", "Tier", "Sparks", "Secret"]}>
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
                      label={`${r.name} secret`}
                      disabled={!canWrite || patch.isPending}
                      onChange={(v) => patch.mutate({ id: r.id, patch: { secret: v } })}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Table head={["Quest", "Kind", "XP", "Sparks", "Active"]}>
              {q.data!.rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-semibold`}>{r.title}</td>
                  <td className={`${td} text-muted text-[13px]`}>{r.kind}</td>
                  <td className={td}>{numCell(r, "xp", canWrite)}</td>
                  <td className={td}>{numCell(r, "sparks", canWrite)}</td>
                  <td className={td}>
                    <Toggle
                      on={!!r.active}
                      label={`${r.title} active`}
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
          {c.saved}
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
      <PageTitle title="Feature flags">
        <span className="text-muted text-[14px]">Every new game and event ships behind a flag. Changes are live at once.</span>
      </PageTitle>
      {put.error && <Notice tone="danger">{errorText(put.error)}</Notice>}
      {added && (
        <Notice tone="ok" icon="check-circle">
          Added {added} (off). Flags are listed by key.
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
          <Field label="New flag key" htmlFor="flagkey">
            <input
              id="flagkey"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="event.exam_season"
              pattern="[a-z0-9_.:\-]{2,60}"
              required
              className={`${inputCls} w-72`}
            />
          </Field>
          <Btn type="submit" icon="plus" disabled={put.isPending}>
            Add (off)
          </Btn>
        </form>
      )}
      <Frame q={q}>
        {() => (
          <Table head={["Flag", "State", "Payload", "Changed"]}>
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
        aria-label={`${flag.key} payload`}
        value={text}
        readOnly={!canWrite}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={!valid}
        className={`${inputCls} num min-w-[200px] text-[13px] ${valid ? "" : "shadow-[inset_0_0_0_2px_var(--danger)]"}`}
      />
      {canWrite && text !== initial && (
        <Btn size="sm" disabled={!valid} onClick={() => onSave(JSON.parse(text))}>
          Save
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

const AUDIT_FILTERS = { actor: "", action: "", target: "", from: "", to: "" } as const;

export function AuditPage() {
  const [{ actor, action, target, from, to }, setFilters] = useUrlFilters(AUDIT_FILTERS);
  const [actionText, setActionText] = useDebouncedFilter(action, (v) => setFilters({ action: v }, { replace: true }));
  const [targetText, setTargetText] = useDebouncedFilter(target, (v) => setFilters({ target: v }, { replace: true }));
  const pager = usePager();
  const qs = new URLSearchParams({
    ...(actor && { actor }),
    ...(action && { action }),
    ...(target && { target }),
    ...(from && { from }),
    ...(to && { to }),
  });
  const q = useAdminQuery<AdminPage<AuditRow> & { actors: { id: string; email: string | null; role: Role }[] }>(
    ["audit", qs.toString(), pager.query],
    `/api/admin/audit?${qs}${qs.size ? "&" : ""}${pager.query}`,
    { keepPrevious: true },
  );
  const who = (id: string | null) => (id ? (q.data?.actors.find((a) => a.id === id)?.email ?? id.slice(0, 8)) : "system");
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title="Audit log">
        <span className="text-muted text-[14px]">Every admin action, newest first. Append-only.</span>
      </PageTitle>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Who" htmlFor="a-actor">
          <select id="a-actor" value={actor} onChange={(e) => setFilters({ actor: e.target.value })} className={`${inputCls} w-56`}>
            <option value="">Anyone</option>
            <option value="system">System (cron)</option>
            {q.data?.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email ?? a.id.slice(0, 8)} ({ROLE_LABEL[a.role]})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action starts with" htmlFor="a-action">
          <input
            id="a-action"
            value={actionText}
            placeholder="daily."
            onChange={(e) => setActionText(e.target.value.toLowerCase())}
            className={`${inputCls} w-40`}
          />
        </Field>
        <Field label="Target contains" htmlFor="a-target">
          <input
            id="a-target"
            value={targetText}
            placeholder="crownfall"
            onChange={(e) => setTargetText(e.target.value)}
            className={`${inputCls} w-40`}
          />
        </Field>
        <Field label="From" htmlFor="a-from">
          <input
            id="a-from"
            type="date"
            max={todayIso()}
            value={from}
            onChange={(e) => setFilters({ from: e.target.value }, { replace: true })}
            className={`${inputCls} w-40`}
          />
        </Field>
        <Field label="To" htmlFor="a-to">
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
            <Empty icon="clock-counter-clockwise">No actions match.</Empty>
          ) : (
            <Table head={["When (GMT)", "Who", "Action", "Target", "Detail"]} min={860}>
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

export function TeamPage() {
  const pager = usePager();
  const q = useAdminQuery<
    AdminPage<{
      user_id: string;
      role: Role;
      email: string | null;
      totp_enrolled: boolean;
      disabled_at: string | null;
      last_sign_in_at: string | null;
    }> & { me: string }
  >(["team", pager.query], `/api/admin/team?${pager.query}`, { keepPrevious: true });
  const add = useAdminAction<{ email: string; role: Role }, { resetSent: boolean }>("POST", "/api/admin/team");
  const patch = useAdminAction<{ id: string; role?: Role; disabled?: boolean }>("PATCH", (i) => `/api/admin/team/${i.id}`);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("content_editor");
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title="Team">
        <span className="text-muted text-[14px]">
          New admins get a password-reset email, then set up their authenticator on first sign-in.
        </span>
      </PageTitle>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ email, role }, { onSuccess: () => (setEmail(""), pager.reset()) });
        }}
      >
        <Field label="Email" htmlFor="t-email">
          <input
            id="t-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls} w-72`}
          />
        </Field>
        <Field label="Role" htmlFor="t-role">
          <select id="t-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${inputCls} w-48`}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Btn type="submit" tone="primary" icon="user-plus" disabled={add.isPending}>
          Add admin
        </Btn>
      </form>
      {(add.error || patch.error) && <Notice tone="danger">{errorText(add.error ?? patch.error)}</Notice>}
      {add.data && (
        <Notice tone="ok" icon="check-circle">
          Added. {add.data.resetSent ? "A password-reset email is on its way." : "They already have a password."}
        </Notice>
      )}
      <Frame q={q}>
        {() => (
          <Table head={["Admin", "Role", "Authenticator", "Last sign-in", "Access"]}>
            {q.data!.rows.map((a) => {
              const self = a.user_id === q.data!.me;
              return (
                <tr key={a.user_id}>
                  <td className={`${td} font-semibold`}>
                    {a.email ?? a.user_id.slice(0, 8)}
                    {self && <span className="text-muted text-[13px] font-medium"> (you)</span>}
                  </td>
                  <td className={td}>
                    <select
                      aria-label={`Role for ${a.email}`}
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
                  <td className={td}>{a.totp_enrolled ? <Pill tone="ok">on</Pill> : <Pill tone="warn">not yet</Pill>}</td>
                  <td className={`${td} num text-muted text-[13px]`}>{a.last_sign_in_at ? age(a.last_sign_in_at) + " ago" : "never"}</td>
                  <td className={td}>
                    {self ? (
                      <span className="text-muted text-[13px]">Active</span>
                    ) : (
                      <Btn
                        size="sm"
                        tone={a.disabled_at ? "secondary" : "ghost"}
                        icon={a.disabled_at ? "user-plus" : "user-minus"}
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: a.user_id, disabled: !a.disabled_at })}
                      >
                        {a.disabled_at ? "Enable" : "Disable"}
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
