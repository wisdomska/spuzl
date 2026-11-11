"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { WORLDS, WORLD_BY_ID } from "@/lib/catalog";
import {
  EVENT_ACCENTS,
  EVENT_GOALS,
  EVENT_QUIZZES,
  windowProblem,
  type AdminEventStatus,
  type EventGoal,
  type EventQuest,
} from "@/lib/events";
import type { EventTemplate, EventTemplateId } from "@/lib/events/templates";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { EVENT_SORT } from "@/lib/admin/sorting";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, usePager } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { useUrlFilters, useUrlSort } from "./useUrlFilters";
import { PageHead, StateGuide, StatePill, type StateWords } from "./content-ui";
import { Btn, Confirm, Empty, Field, Notice, RowsSkeleton, inputCls, textareaCls } from "./ui";
import { Select } from "@/components/ui/Select";
import { DateTimeField } from "@/components/ui/DateField";

/**
 * Seasonal events (Phase 5, "features.seasonal"): list, create, edit and delete; R2-P5 adds ready-made templates
 * (added as drafts with one click) and Schedule / Back to draft. The server validates and audits.
 */

interface EventItem {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  accent: string;
  banner: string;
  quest: EventQuest;
  quiz?: string | null;
  status: AdminEventStatus;
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
  /** "" for none */
  quiz: string;
}

const C = adminCopy.events;
const GOAL_LABEL: Record<EventGoal, string> = C.goals;
const LOOK: Record<AdminEventStatus, { tone: "ok" | "warn" | "neutral"; icon: string }> = {
  live: { tone: "ok", icon: "play-circle" },
  upcoming: { tone: "warn", icon: "calendar-blank" },
  ended: { tone: "neutral", icon: "check" },
  draft: { tone: "neutral", icon: "pencil-simple" },
};
const STATE: Record<AdminEventStatus, StateWords> = Object.fromEntries(
  (["draft", "upcoming", "live", "ended"] as const).map((s) => [s, { label: C.statuses[s], meaning: C.statusMeaning[s], ...LOOK[s] }]),
) as Record<AdminEventStatus, StateWords>;
const accentName = (a: string) =>
  a.startsWith("w-")
    ? C.worldColour((WORLD_BY_ID as Record<string, { name: string } | undefined>)[a.slice(2)]?.name ?? a.slice(2))
    : (C.accentNames[a] ?? a);
const goalWords = (q: EventQuest) =>
  adminCopy.eventQuests.goal[q.kind](
    q.n,
    q.world ? ((WORLD_BY_ID as Record<string, { name: string } | undefined>)[q.world]?.name ?? q.world) : "",
  );
const E = adminCopy.events;
const FILTERS = { status: "" } as const;
const ALLOWED = { status: ["draft", "upcoming", "live", "ended"] };
const COLS: HeadCol<(typeof EVENT_SORT.keys)[number]>[] = [
  { label: E.head[0], sort: "name" },
  { label: E.head[1], sort: "starts_at" },
  { label: E.head[2] },
  { label: E.head[3] },
  { label: E.head[4] },
  { label: E.head[5], hidden: true },
];

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
    quiz: "",
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
    quiz: e.quiz ?? "",
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
    quiz: (d.quiz || null) as (typeof EVENT_QUIZZES)[number] | null,
  };
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function EventsPage({ canWrite }: { canWrite: boolean }) {
  const pager = usePager();
  // Read live from the admin settings route (every events.read role holds settings.read); undefined while loading,
  // so the "off" notice never flashes.
  const settings = useAdminQuery<{ rows: { key: string; value: unknown }[] }>(["game-settings"], "/api/admin/settings");
  const seasonalOn = settings.data ? settings.data.rows.find((r) => r.key === "features.seasonal")?.value === true : undefined;
  const sort = useUrlSort(EVENT_SORT);
  const [{ status }, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const q = useAdminQuery<AdminPage<EventItem>>(
    ["events", status, sort.query, pager.query],
    `/api/admin/events?${status ? `status=${status}&` : ""}${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  const create = useAdminAction<ReturnType<typeof payload>>("POST", "/api/admin/events");
  const edit = useAdminAction<ReturnType<typeof payload> & { id: string }>("PATCH", (i) => `/api/admin/events/${i.id}`);
  const remove = useAdminAction<{ id: string }>("DELETE", (i) => `/api/admin/events/${i.id}`);
  const schedule = useAdminAction<{ id: string; scheduled: boolean }>("POST", (i) => `/api/admin/events/${i.id}/schedule`);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // The plain-words confirm before an event stops or is deleted (replaces the browser's own confirm box).
  const [ask, setAsk] = useState<{ what: "delete" | "unschedule"; id: string; name: string } | null>(null);
  const error = create.error ?? edit.error ?? remove.error ?? schedule.error;

  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead
        title={C.title}
        purpose={C.intro}
        aside={
          canWrite && !editing ? (
            <Btn tone="primary" icon="plus" size="lg" onClick={() => (setDone(null), setEditing({ id: null, draft: blank() }))}>
              {C.newEvent}
            </Btn>
          ) : undefined
        }
      />
      {seasonalOn === false && (
        <Notice
          tone="warn"
          icon="toggle-left"
          action={
            <Link href="/admin/settings" className="flex min-h-11 items-center font-semibold underline">
              {C.offLink}
            </Link>
          }
        >
          {C.off}
        </Notice>
      )}
      <div aria-live="polite" className="empty:hidden">
        {error ? (
          <Notice tone="danger" icon="warning">
            {errorText(error)}
          </Notice>
        ) : done ? (
          <Notice tone="ok" icon="check-circle">
            {done}
          </Notice>
        ) : null}
      </div>
      {canWrite && !editing && <Templates onAdded={(name) => setDone(C.templateAdded(name))} />}
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
      <StateGuide states={Object.values(STATE)} />
      <div className="text-muted flex items-center gap-2 self-start text-[13px] font-semibold">
        <span id="ev-status-filter">{E.statusFilter}</span>
        <Select
          aria-labelledby="ev-status-filter"
          value={status}
          onValueChange={(v) => setFilters({ status: v })}
          options={[
            { value: "", label: E.anyStatus },
            ...ALLOWED.status.map((s) => ({ value: s, label: E.statuses[s as AdminEventStatus] })),
          ]}
          className="h-11 w-44"
        />
      </div>
      <div className="bg-surface relative overflow-x-auto rounded-[16px]">
        {q.isPending ? (
          <RowsSkeleton />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {C.loadError} {errorText(q.error)}
            </Notice>
          </div>
        ) : q.data!.rows.length === 0 ? (
          <Empty icon="calendar-blank">{status ? C.emptyFiltered : C.empty}</Empty>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-[14px]">
            <SortHead cols={COLS} sort={sort} />
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
                    <StatePill s={STATE[e.status]} />
                  </td>
                  <td className="border-line border-t px-3 py-2 text-[13px]">
                    {e.quest.title}
                    <span className="text-muted block text-[12px]">{C.questLine(goalWords(e.quest), e.quest.xp, e.quest.sparks)}</span>
                  </td>
                  <td className="border-line num border-t px-3 py-2 text-right">{e.completed.toLocaleString("en-US")}</td>
                  <td className="border-line border-t px-3 py-2">
                    {canWrite && (
                      <span className="flex justify-end gap-1">
                        {e.status === "draft" ? (
                          <Btn
                            size="lg"
                            tone="primary"
                            icon="calendar-blank"
                            aria-label={C.scheduleAria(e.name)}
                            title={C.scheduleHelp}
                            disabled={schedule.isPending}
                            onClick={() =>
                              schedule.mutate({ id: e.id, scheduled: true }, { onSuccess: () => setDone(C.scheduled(e.name)) })
                            }
                          >
                            {C.schedule}
                          </Btn>
                        ) : e.status !== "ended" ? (
                          <Btn
                            size="lg"
                            tone="ghost"
                            icon="pause"
                            aria-label={C.unscheduleAria(e.name)}
                            title={C.unscheduleAria(e.name)}
                            disabled={schedule.isPending}
                            onClick={() => setAsk({ what: "unschedule", id: e.id, name: e.name })}
                          >
                            {C.unschedule}
                          </Btn>
                        ) : null}
                        <Btn
                          size="lg"
                          tone="ghost"
                          icon="pencil-simple"
                          aria-label={C.editAria(e.name)}
                          title={C.editAria(e.name)}
                          onClick={() => (setDone(null), setEditing({ id: e.id, draft: draftOf(e) }))}
                        />
                        <Btn
                          size="lg"
                          tone="ghost"
                          icon="trash"
                          aria-label={C.deleteAria(e.name)}
                          title={C.deleteAria(e.name)}
                          disabled={remove.isPending}
                          onClick={() => setAsk({ what: "delete", id: e.id, name: e.name })}
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
      <Confirm
        open={!!ask}
        title={ask ? (ask.what === "delete" ? C.confirmDelete : C.confirmUnschedule).title(ask.name) : ""}
        body={ask?.what === "delete" ? C.confirmDelete.body : C.confirmUnschedule.body}
        confirmLabel={ask?.what === "delete" ? C.confirmDelete.confirm : C.confirmUnschedule.confirm}
        danger
        busy={remove.isPending || schedule.isPending}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          if (!ask) return;
          const { id, name } = ask;
          const close = () => setAsk(null);
          if (ask.what === "delete") remove.mutate({ id }, { onSuccess: () => setDone(C.deleted(name)), onSettled: close });
          else schedule.mutate({ id, scheduled: false }, { onSuccess: () => setDone(C.unscheduled(name)), onSettled: close });
        }}
      />
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
        <Field
          label={C.accent}
          htmlFor="ev-accent"
          hint={
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-[3px]" style={{ background: `var(--${d.accent})` }} />
              {C.preview}
            </span>
          }
        >
          <Select
            id="ev-accent"
            value={d.accent}
            onValueChange={(v) => set("accent", v)}
            options={EVENT_ACCENTS.map((a) => ({
              value: a,
              textValue: accentName(a),
              label: (
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={{ background: `var(--${a})` }} />
                  {accentName(a)}
                </span>
              ),
            }))}
            className="w-full"
          />
        </Field>
        <Field label={C.starts} htmlFor="ev-start">
          <DateTimeField id="ev-start" label={C.starts} value={d.startsAt} onChange={(v) => set("startsAt", v)} />
        </Field>
        <Field label={C.ends} htmlFor="ev-end" hint={problem ?? undefined}>
          <DateTimeField id="ev-end" label={C.ends} aria-invalid={!!problem} value={d.endsAt} onChange={(v) => set("endsAt", v)} />
        </Field>
      </div>
      <Field label={C.quiz} htmlFor="ev-quiz" hint={C.quizHint}>
        <Select
          id="ev-quiz"
          value={d.quiz}
          onValueChange={(v) => set("quiz", v)}
          options={[{ value: "", label: C.quizNone }, ...EVENT_QUIZZES.map((q) => ({ value: q, label: C.quizzes[q] }))]}
          className="w-full"
        />
      </Field>
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
        <legend className="mb-1 text-[15px] font-bold">{C.bonusQuest}</legend>
        <p className="text-muted -mt-2 text-[13px]">{C.bonusIntro}</p>
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
            <Select
              id="ev-kind"
              value={d.kind}
              onValueChange={(v) => set("kind", v as EventGoal)}
              options={EVENT_GOALS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))}
              className="w-full"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          {num("n", C.howMany, 1, 100)}
          {d.kind === "world_clears" && (
            <Field label={C.world} htmlFor="ev-world">
              <Select
                id="ev-world"
                value={d.world}
                onValueChange={(v) => set("world", v)}
                options={WORLDS.map((w) => ({ value: w.id, label: w.name }))}
                className="w-48"
              />
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

/** R2-P5: the ready-made events. "Add as draft" makes an inactive event with the template's next dates. */
function Templates({ onAdded }: { onAdded: (name: string) => void }) {
  const q = useAdminQuery<{ rows: (EventTemplate & { startsAt: string; endsAt: string })[] }>(
    ["event-templates"],
    "/api/admin/events/templates",
  );
  const add = useAdminAction<{ template: EventTemplateId }>("POST", "/api/admin/events/templates");
  if (!q.data) return null;
  return (
    <section aria-labelledby="ev-templates" className="flex flex-col gap-2.5">
      <h2 id="ev-templates" className="text-[15px] font-bold">
        {C.templatesTitle}
      </h2>
      <p className="text-muted text-[13px]">{C.templatesIntro}</p>
      {add.error && <Notice tone="danger">{errorText(add.error)}</Notice>}
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {q.data.rows.map((t) => (
          <li
            key={t.id}
            className="bg-surface flex flex-col gap-2 rounded-[12px] p-3.5"
            style={{ boxShadow: `inset 4px 0 0 var(--${t.accent})` }}
          >
            <span className="font-semibold">{t.name}</span>
            <span className="text-muted text-[13px]">{t.blurb}</span>
            <span className="num text-muted text-[12px]">
              {t.fixedDates ? C.templateDates(day(t.startsAt), day(t.endsAt)) : C.setDates}
            </span>
            <Btn
              size="lg"
              icon="plus"
              className="self-start"
              aria-label={C.addTemplateAria(t.name)}
              disabled={add.isPending}
              onClick={() => add.mutate({ template: t.id }, { onSuccess: () => onAdded(t.name) })}
            >
              {C.addTemplate}
            </Btn>
          </li>
        ))}
      </ul>
    </section>
  );
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
