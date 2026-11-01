"use client";

import { useState, type FormEvent } from "react";
import { WORLDS } from "@/lib/catalog";
import { EVENT_ACCENTS, EVENT_GOALS, windowProblem, type EventGoal, type EventQuest, type EventStatus } from "@/lib/events";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, usePager } from "./Pagination";
import { Btn, Empty, Field, Notice, PageTitle, Pill, RowsSkeleton, inputCls, textareaCls } from "./ui";

/** Seasonal events (Phase 5, "features.seasonal"): list, create, edit and delete. The server validates and audits. */

interface EventItem {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  accent: string;
  banner: string;
  quest: EventQuest;
  status: EventStatus;
  completed: number;
}

interface Draft {
  name: string;
  startsAt: string;
  endsAt: string;
  accent: string;
  banner: string;
  title: string;
  kind: EventGoal;
  n: number;
  world: string;
  xp: number;
  sparks: number;
}

const C = adminCopy.events;
const GOAL_LABEL: Record<EventGoal, string> = C.goals;
const STATUS_TONE: Record<EventStatus, "ok" | "warn" | "neutral"> = { live: "ok", upcoming: "warn", ended: "neutral" };

/** ISO time to the value of a datetime-local input (the admin's local time). */
function toLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : "");

function blank(): Draft {
  const start = new Date(Date.now() + 3_600_000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return {
    name: "",
    startsAt: toLocal(start.toISOString()),
    endsAt: toLocal(end.toISOString()),
    accent: "gold",
    banner: "",
    title: "",
    kind: "free_clears",
    n: 5,
    world: "logic",
    xp: 100,
    sparks: 50,
  };
}

function draftOf(e: EventItem): Draft {
  return {
    name: e.name,
    startsAt: toLocal(e.starts_at),
    endsAt: toLocal(e.ends_at),
    accent: e.accent,
    banner: e.banner,
    title: e.quest.title,
    kind: e.quest.kind,
    n: e.quest.n,
    world: e.quest.world ?? "logic",
    xp: e.quest.xp,
    sparks: e.quest.sparks,
  };
}

function payload(d: Draft) {
  return {
    name: d.name,
    startsAt: fromLocal(d.startsAt),
    endsAt: fromLocal(d.endsAt),
    accent: d.accent,
    banner: d.banner,
    quest: {
      title: d.title,
      kind: d.kind,
      n: d.n,
      ...(d.kind === "world_clears" ? { world: d.world } : {}),
      xp: d.xp,
      sparks: d.sparks,
    },
  };
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function EventsPage({ canWrite }: { canWrite: boolean }) {
  const pager = usePager();
  // Read live from the admin settings route (every events.read role holds settings.read); undefined while loading,
  // so the "off" notice never flashes.
  const settings = useAdminQuery<{ rows: { key: string; value: unknown }[] }>(["game-settings"], "/api/admin/settings");
  const seasonalOn = settings.data ? settings.data.rows.find((r) => r.key === "features.seasonal")?.value === true : undefined;
  const q = useAdminQuery<AdminPage<EventItem>>(["events", pager.query], `/api/admin/events?${pager.query}`, { keepPrevious: true });
  const create = useAdminAction<ReturnType<typeof payload>>("POST", "/api/admin/events");
  const edit = useAdminAction<ReturnType<typeof payload> & { id: string }>("PATCH", (i) => `/api/admin/events/${i.id}`);
  const remove = useAdminAction<{ id: string }>("DELETE", (i) => `/api/admin/events/${i.id}`);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const error = create.error ?? edit.error ?? remove.error;

  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title={C.title}
        aside={
          canWrite && !editing ? (
            <Btn tone="primary" icon="plus" size="lg" onClick={() => (setDone(null), setEditing({ id: null, draft: blank() }))}>
              {C.newEvent}
            </Btn>
          ) : undefined
        }
      >
        <span className="text-muted text-[14px]">{C.intro}</span>
      </PageTitle>
      {seasonalOn === false && (
        <Notice tone="warn" icon="toggle-left">
          {C.off}
        </Notice>
      )}
      {error && <Notice tone="danger">{errorText(error)}</Notice>}
      {done && (
        <Notice tone="ok" icon="check-circle">
          {done}
        </Notice>
      )}
      {editing && (
        <EventForm
          key={editing.id ?? "new"}
          initial={editing.draft}
          busy={create.isPending || edit.isPending}
          isNew={!editing.id}
          onCancel={() => setEditing(null)}
          onSave={(d) => {
            const body = payload(d);
            const after = () => (setEditing(null), setDone(C.saved(d.name)));
            if (editing.id) edit.mutate({ ...body, id: editing.id }, { onSuccess: after });
            else create.mutate(body, { onSuccess: after });
          }}
        />
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
        ) : q.data!.rows.length === 0 ? (
          <Empty icon="calendar-blank">{C.empty}</Empty>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                {C.head.map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2.5 font-semibold">
                    {h || <span className="sr-only">{C.actions}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data!.rows.map((e) => (
                <tr key={e.id}>
                  <td className="border-line border-t px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--${e.accent})` }} />
                      <span className="flex flex-col">
                        <span className="font-semibold">{e.name}</span>
                        <span className="text-muted text-[12px]">{e.banner}</span>
                      </span>
                    </span>
                  </td>
                  <td className="border-line num text-muted border-t px-3 py-2 text-[13px] whitespace-nowrap">
                    {C.runs(when(e.starts_at), when(e.ends_at))}
                  </td>
                  <td className="border-line border-t px-3 py-2">
                    <Pill tone={STATUS_TONE[e.status]}>{e.status}</Pill>
                  </td>
                  <td className="border-line border-t px-3 py-2 text-[13px]">
                    {e.quest.title}
                    <span className="num text-muted block text-[12px]">{C.questLine(e.quest.n, e.quest.xp, e.quest.sparks)}</span>
                  </td>
                  <td className="border-line num border-t px-3 py-2">{e.completed}</td>
                  <td className="border-line border-t px-3 py-2">
                    {canWrite && (
                      <span className="flex justify-end gap-1">
                        <Btn
                          size="lg"
                          tone="ghost"
                          icon="pencil-simple"
                          aria-label={C.editAria(e.name)}
                          onClick={() => (setDone(null), setEditing({ id: e.id, draft: draftOf(e) }))}
                        />
                        <Btn
                          size="lg"
                          tone="ghost"
                          icon="trash"
                          aria-label={C.deleteAria(e.name)}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(C.confirmDelete(e.name)))
                              remove.mutate({ id: e.id }, { onSuccess: () => setDone(C.deleted(e.name)) });
                          }}
                        />
                      </span>
                    )}
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

function EventForm({
  initial,
  busy,
  isNew,
  onSave,
  onCancel,
}: {
  initial: Draft;
  busy: boolean;
  isNew: boolean;
  onSave: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const problem = d.startsAt && d.endsAt ? windowProblem(fromLocal(d.startsAt), fromLocal(d.endsAt)) : C.pickDates;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!problem) onSave(d);
  };
  const num = (k: "n" | "xp" | "sparks", label: string, min: number, max: number) => (
    <Field label={label} htmlFor={`ev-${k}`}>
      <input
        id={`ev-${k}`}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        required
        value={d[k]}
        onChange={(e) => set(k, Number(e.target.value))}
        className={`${inputCls} num w-28`}
      />
    </Field>
  );
  return (
    <form onSubmit={submit} className="bg-surface flex flex-col gap-3 rounded-[12px] p-4" aria-label={isNew ? C.newEvent : C.editEvent}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={C.name} htmlFor="ev-name">
          <input
            id="ev-name"
            required
            minLength={2}
            maxLength={60}
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={C.namePlaceholder}
            className={inputCls}
          />
        </Field>
        <Field label={C.accent} htmlFor="ev-accent" hint={<span style={{ color: `var(--${d.accent})` }}>{C.preview}</span>}>
          <select id="ev-accent" value={d.accent} onChange={(e) => set("accent", e.target.value)} className={inputCls}>
            {EVENT_ACCENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label={C.starts} htmlFor="ev-start">
          <input
            id="ev-start"
            type="datetime-local"
            required
            value={d.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={C.ends} htmlFor="ev-end" hint={problem ?? undefined}>
          <input
            id="ev-end"
            type="datetime-local"
            required
            aria-invalid={!!problem}
            value={d.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label={C.banner} htmlFor="ev-banner" hint={C.bannerCount(d.banner.length)}>
        <textarea
          id="ev-banner"
          required
          minLength={2}
          maxLength={140}
          rows={2}
          value={d.banner}
          onChange={(e) => set("banner", e.target.value)}
          placeholder={C.bannerPlaceholder}
          className={textareaCls}
        />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[14px] font-bold">{C.bonusQuest}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={C.questTitle} htmlFor="ev-title">
            <input
              id="ev-title"
              required
              minLength={2}
              maxLength={60}
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={C.questPlaceholder}
              className={inputCls}
            />
          </Field>
          <Field label={C.goal} htmlFor="ev-kind">
            <select id="ev-kind" value={d.kind} onChange={(e) => set("kind", e.target.value as EventGoal)} className={inputCls}>
              {EVENT_GOALS.map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABEL[g]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          {num("n", C.howMany, 1, 100)}
          {d.kind === "world_clears" && (
            <Field label={C.world} htmlFor="ev-world">
              <select id="ev-world" value={d.world} onChange={(e) => set("world", e.target.value)} className={inputCls}>
                {WORLDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {num("xp", C.xp, 0, 1000)}
          {num("sparks", C.sparks, 0, 500)}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Btn type="submit" tone="primary" size="lg" icon="check" disabled={busy || !!problem}>
          {isNew ? C.create : C.save}
        </Btn>
        <Btn size="lg" onClick={onCancel}>
          {C.cancel}
        </Btn>
      </div>
    </form>
  );
}
