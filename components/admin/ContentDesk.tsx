"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_BY_ID } from "@/lib/catalog";
import { CONTENT_GAMES, SCHEDULABLE, TEMPLATES, validatePayload, type ContentGame } from "@/lib/admin/content-schemas";
import { addDays, age, dayMonth, todayIso } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { Btn, Empty, Field, Notice, PageTitle, Pill, RowsSkeleton, Swatch, Tabs, inputCls, textareaCls, type PillTone } from "./ui";

interface Item {
  id: string;
  game_id: string;
  payload: unknown;
  author_id: string;
  reviewer_id: string | null;
  status: "draft" | "in_review" | "approved" | "rejected" | "scheduled";
  notes: string | null;
  updated_at: string;
  scheduled_for: string | null;
  author_email?: string | null;
  reviewer_email?: string | null;
}

const TONE: Record<Item["status"], PillTone> = { draft: "neutral", in_review: "warn", approved: "ok", rejected: "danger", scheduled: "ok" };
const label = (s: string) => s.replace("_", " ");

/** A one-line summary of a payload: its first text field. */
function summary(p: unknown): string {
  if (!p || typeof p !== "object") return "";
  const o = p as Record<string, unknown>;
  for (const k of ["theme", "category", "q", "name", "label", "phrase", "pangram"])
    if (typeof o[k] === "string" && o[k]) return o[k] as string;
  if (Array.isArray(o.words)) return (o.words as string[]).filter(Boolean).join(" ");
  if (Array.isArray(o.groups)) return (o.groups as { label: string }[]).map((g) => g.label).join(" / ");
  if (Array.isArray(o.rows)) return (o.rows as string[]).join(" ");
  if (Array.isArray(o.items)) return `${(o.items as unknown[]).length} questions`;
  return JSON.stringify(p).slice(0, 80);
}

/** Content editor (FR-AD-03): drafts, two-person review, scheduling, and the owner's review of content.ts entries. */
export function ContentDesk(props: { canWrite: boolean; canApprove: boolean; canSchedule: boolean; isOwner: boolean }) {
  const [tab, setTab] = useState<"items" | "files">("items");
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title="Content"
        aside={
          <Tabs
            label="Content views"
            value={tab}
            onChange={setTab}
            items={[
              { id: "items", label: "Written items" },
              { id: "files", label: "content.ts review" },
            ]}
          />
        }
      />
      {tab === "items" ? <Items {...props} /> : <FileReview isOwner={props.isOwner} />}
    </div>
  );
}

function Items({ canWrite, canApprove, canSchedule }: { canWrite: boolean; canApprove: boolean; canSchedule: boolean }) {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | "new" | null>(null);
  const q = useAdminQuery<{ me: string; rows: Item[] }>(["content", status], `/api/admin/content${status ? `?status=${status}` : ""}`);
  const item = open && open !== "new" ? q.data?.rows.find((r) => r.id === open) : undefined;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_480px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} w-44`}>
            <option value="">Any status</option>
            {["draft", "in_review", "approved", "rejected", "scheduled"].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          {canWrite && (
            <Btn tone="primary" icon="plus" className="ml-auto" onClick={() => setOpen("new")}>
              New item
            </Btn>
          )}
        </div>
        <div className="bg-surface overflow-x-auto rounded-[12px]">
          {q.isPending ? (
            <RowsSkeleton />
          ) : q.error ? (
            <div className="p-3">
              <Notice tone="danger">{errorText(q.error)}</Notice>
            </div>
          ) : !q.data.rows.length ? (
            <Empty icon="note-pencil">No written items yet.</Empty>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                  {["Game", "Item", "Status", "Author", "Updated"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-line border-t ${open === r.id ? "bg-[var(--success-tint)]" : "hover:bg-surface-raised/50"}`}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-semibold">
                        <Swatch world={GAME_BY_ID[r.game_id]?.world ?? "word"} />
                        {GAME_BY_ID[r.game_id]?.name ?? r.game_id}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpen(r.id)}
                        className="block w-full truncate text-left font-medium hover:underline"
                      >
                        {summary(r.payload) || "Untitled"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={TONE[r.status]}>{label(r.status)}</Pill>
                    </td>
                    <td className="text-muted max-w-[160px] truncate px-3 py-2 text-[13px]">
                      {r.author_id === q.data.me ? "you" : (r.author_email ?? "editor")}
                    </td>
                    <td className="num text-muted px-3 py-2 text-[13px]">{age(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {open && (
        <Editor
          key={open}
          item={item}
          me={q.data?.me ?? ""}
          canWrite={canWrite}
          canApprove={canApprove}
          canSchedule={canSchedule}
          onCreated={(id) => setOpen(id)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Editor({
  item,
  me,
  canWrite,
  canApprove,
  canSchedule,
  onCreated,
  onClose,
}: {
  item?: Item;
  me: string;
  canWrite: boolean;
  canApprove: boolean;
  canSchedule: boolean;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [game, setGame] = useState<ContentGame>((item?.game_id as ContentGame) ?? "hunch");
  const [text, setText] = useState(() => JSON.stringify(item?.payload ?? TEMPLATES.hunch, null, 2));
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [date, setDate] = useState(addDays(todayIso(), 8));
  const create = useAdminAction<{ game: string; payload: unknown; notes?: string }, Item>("POST", "/api/admin/content");
  const save = useAdminAction<{ payload?: unknown; notes?: string; submit?: boolean }, Item>("PATCH", `/api/admin/content/${item?.id}`);
  const review = useAdminAction<{ decision: "approve" | "reject"; notes?: string }, Item>("POST", `/api/admin/content/${item?.id}/review`);
  const schedule = useAdminAction<{ itemId: string; date: string }, { puzzleId: string }>("POST", "/api/admin/dailies/schedule");

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false as const };
    }
  }, [text]);
  const check = parsed.ok ? validatePayload(game, parsed.value) : null;
  const mine = !item || item.author_id === me;
  const editable = canWrite && mine && (!item || ["draft", "rejected", "in_review"].includes(item.status));
  const plan = SCHEDULABLE[game];
  const err = create.error ?? save.error ?? review.error ?? schedule.error;

  return (
    <aside aria-label="Item editor" className="bg-surface flex flex-col gap-3 rounded-[12px] p-4 xl:sticky xl:top-5 xl:self-start">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[16px] font-extrabold">{item ? `${GAME_BY_ID[item.game_id]?.name} item` : "New item"}</h2>
        {item && <Pill tone={TONE[item.status]}>{label(item.status)}</Pill>}
        <Btn size="sm" tone="ghost" icon="x" aria-label="Close editor" className="ml-auto" onClick={onClose} />
      </div>
      {!item && (
        <Field label="Game" htmlFor="game">
          <select
            id="game"
            value={game}
            onChange={(e) => {
              const g = e.target.value as ContentGame;
              setGame(g);
              setText(JSON.stringify(TEMPLATES[g], null, 2));
            }}
            className={`${inputCls} w-full`}
          >
            {CONTENT_GAMES.map((g) => (
              <option key={g} value={g}>
                {GAME_BY_ID[g]?.name ?? g}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field
        label="Payload (JSON)"
        htmlFor="payload"
        hint={
          item
            ? `By ${item.author_id === me ? "you" : (item.author_email ?? "an editor")}${item.reviewer_email ? `, reviewed by ${item.reviewer_email}` : ""}`
            : undefined
        }
      >
        <textarea
          id="payload"
          value={text}
          readOnly={!editable}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={14}
          className={`${textareaCls} num resize-y text-[13px]`}
          aria-invalid={!check?.success}
          aria-describedby="payload-issues"
        />
      </Field>
      <div id="payload-issues" aria-live="polite">
        {!parsed.ok ? (
          <Notice tone="danger" icon="warning">
            Not valid JSON yet.
          </Notice>
        ) : check && !check.success ? (
          <ul className="text-danger flex flex-col gap-0.5 text-[13px] font-medium">
            {check.issues.slice(0, 8).map((i, k) => (
              <li key={k}>
                <span className="num">{i.path.join(".") || "payload"}</span>: {i.message}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-accent text-[13px] font-semibold">Matches the {GAME_BY_ID[game]?.name} format.</span>
        )}
      </div>
      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          readOnly={!editable && !(canApprove && !mine)}
          rows={2}
          className={`${textareaCls} resize-y`}
        />
      </Field>
      {err && <Notice tone="danger">{errorText(err)}</Notice>}
      {schedule.data && (
        <Notice tone="ok" icon="check-circle">
          Scheduled for {dayMonth(date)}.{" "}
          <Link className="text-accent underline" href={`/admin/calendar/${game}/${date}`}>
            Open the Daily
          </Link>
        </Notice>
      )}

      {editable && (
        <div className="grid grid-cols-2 gap-2">
          <Btn
            size="lg"
            disabled={!check?.success || create.isPending || save.isPending}
            onClick={() =>
              item
                ? save.mutate({ payload: parsed.ok ? parsed.value : undefined, notes })
                : create.mutate({ game, payload: parsed.ok ? parsed.value : undefined, notes }, { onSuccess: (r) => onCreated(r.id) })
            }
          >
            Save draft
          </Btn>
          <Btn
            size="lg"
            tone="primary"
            disabled={!item || !check?.success || save.isPending || item.status === "in_review"}
            onClick={() => save.mutate({ payload: parsed.ok ? parsed.value : undefined, notes, submit: true })}
          >
            {item?.status === "in_review" ? "In review" : "Submit for review"}
          </Btn>
        </div>
      )}
      {item?.status === "in_review" && !mine && canApprove && (
        <div className="grid grid-cols-2 gap-2">
          <Btn size="lg" disabled={review.isPending} onClick={() => review.mutate({ decision: "reject", notes })}>
            Reject
          </Btn>
          <Btn size="lg" tone="primary" disabled={review.isPending} onClick={() => review.mutate({ decision: "approve", notes })}>
            Approve
          </Btn>
        </div>
      )}
      {item?.status === "in_review" && mine && <span className="text-muted text-[13px]">Waiting for a second person to review.</span>}
      {item?.status === "approved" && canSchedule && (
        <div className="bg-bg flex flex-col gap-2 rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--line)]">
          {!plan ? (
            <span className="text-muted text-[13px]">
              Approved. {GAME_BY_ID[game]?.name} items join the content pool rather than a single Daily.
            </span>
          ) : plan.guessRoute ? (
            <span className="text-muted text-[13px]">
              Approved. {GAME_BY_ID[game]?.name} checks guesses against content.ts, so scheduling a custom item waits for the guess route to
              resolve by puzzle.
            </span>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                schedule.mutate({ itemId: item.id, date });
              }}
            >
              <Field label="Schedule on" htmlFor="sched">
                <input
                  id="sched"
                  type="date"
                  min={addDays(todayIso(), 1)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Btn type="submit" tone="primary" size="lg" disabled={schedule.isPending}>
                Schedule
              </Btn>
            </form>
          )}
        </div>
      )}
      {item?.status === "scheduled" && item.scheduled_for && (
        <Link
          href={`/admin/calendar/${item.game_id}/${item.scheduled_for}`}
          className="text-accent text-[14px] font-semibold hover:underline"
        >
          Scheduled for {dayMonth(item.scheduled_for)}
        </Link>
      )}
    </aside>
  );
}

interface FileGame {
  game: ContentGame;
  total: number;
  approved: number;
  rejected: number;
  entries?: { index: number; entry: unknown; state: "pending" | "approved" | "rejected" | "changed"; notes: string | null }[];
}
const FILE_TONE: Record<string, PillTone> = { pending: "warn", changed: "warn", approved: "ok", rejected: "danger" };

function FileReview({ isOwner }: { isOwner: boolean }) {
  const [game, setGame] = useState<ContentGame | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [only, setOnly] = useState<"todo" | "all">("todo");
  const sum = useAdminQuery<{ games: FileGame[] }>(["files"], "/api/admin/content/files");
  const one = useAdminQuery<{ games: FileGame[] }>(["files", game], game ? `/api/admin/content/files?game=${game}` : null);
  const act = useAdminAction<{ game: string; indexes: number[]; decision: "approve" | "reject" }>("POST", "/api/admin/content/files");
  const entries = (one.data?.games[0]?.entries ?? []).filter((e) => only === "all" || e.state === "pending" || e.state === "changed");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <div className="bg-surface flex flex-col gap-1 rounded-[12px] p-2">
        {sum.isPending ? (
          <RowsSkeleton rows={8} />
        ) : (
          sum.data?.games.map((g) => (
            <button
              key={g.game}
              type="button"
              aria-pressed={game === g.game}
              onClick={() => (setGame(g.game), setPicked(new Set()))}
              className={`flex h-11 items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-semibold ${game === g.game ? "bg-surface-raised" : "hover:bg-surface-raised/60"}`}
            >
              <Swatch world={GAME_BY_ID[g.game]?.world ?? "word"} />
              <span className="flex-1">{GAME_BY_ID[g.game]?.name ?? g.game}</span>
              <span className="num text-muted text-[12px]">
                {g.approved}/{g.total}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {!game ? (
          <Notice icon="info">
            Every content.ts below is marked needsReview.{" "}
            {isOwner ? "Approve entries to record your review." : "Only the owner can approve these."}
          </Notice>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                label="Show"
                value={only}
                onChange={setOnly}
                items={[
                  { id: "todo", label: "To review" },
                  { id: "all", label: "All" },
                ]}
              />
              {isOwner && (
                <div className="ml-auto flex gap-2">
                  <Btn
                    disabled={!picked.size || act.isPending}
                    onClick={() =>
                      act.mutate({ game, indexes: [...picked], decision: "reject" }, { onSuccess: () => setPicked(new Set()) })
                    }
                  >
                    Reject {picked.size || ""}
                  </Btn>
                  <Btn
                    tone="primary"
                    disabled={!picked.size || act.isPending}
                    onClick={() =>
                      act.mutate({ game, indexes: [...picked], decision: "approve" }, { onSuccess: () => setPicked(new Set()) })
                    }
                  >
                    Approve {picked.size || ""}
                  </Btn>
                </div>
              )}
            </div>
            {act.error && <Notice tone="danger">{errorText(act.error)}</Notice>}
            <div className="bg-surface overflow-x-auto rounded-[12px]">
              {one.isPending ? (
                <RowsSkeleton />
              ) : !entries.length ? (
                <Empty>Nothing left to review for {GAME_BY_ID[game]?.name}.</Empty>
              ) : (
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                      {isOwner && (
                        <th scope="col" className="w-11 px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label="Select all shown"
                            checked={picked.size > 0 && entries.every((e) => picked.has(e.index))}
                            onChange={(e) => setPicked(e.target.checked ? new Set(entries.map((x) => x.index)) : new Set())}
                            className="size-5 accent-[var(--accent)]"
                          />
                        </th>
                      )}
                      <th scope="col" className="w-14 px-3 py-2.5 font-semibold">
                        #
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Entry
                      </th>
                      <th scope="col" className="w-28 px-3 py-2.5 font-semibold">
                        State
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.index} className="border-line border-t align-top">
                        {isOwner && (
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Select entry ${e.index}`}
                              checked={picked.has(e.index)}
                              onChange={(ev) => {
                                const n = new Set(picked);
                                if (ev.target.checked) n.add(e.index);
                                else n.delete(e.index);
                                setPicked(n);
                              }}
                              className="size-5 accent-[var(--accent)]"
                            />
                          </td>
                        )}
                        <td className="num text-muted px-3 py-2 text-[13px]">{e.index}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold">{summary(e.entry)}</span>
                          <pre className="num text-muted mt-1 max-h-24 overflow-auto text-[12px] leading-[1.35] whitespace-pre-wrap">
                            {JSON.stringify(e.entry)}
                          </pre>
                        </td>
                        <td className="px-3 py-2">
                          <Pill tone={FILE_TONE[e.state]}>{e.state === "changed" ? "changed since" : e.state}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
