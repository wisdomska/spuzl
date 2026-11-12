"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_BY_ID } from "@/lib/catalog";
import { CONTENT_GAMES, SCHEDULABLE, TEMPLATES, validatePayload, type ContentGame } from "@/lib/admin/content-schemas";
import { REVIEW_SHOW, type ReviewShow } from "@/lib/admin/content-review";
import { addDays, dayMonth, todayIso } from "@/lib/admin/dates";
import { CONTENT_SORT } from "@/lib/admin/sorting";
import { errorText, useAdminAction, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, usePager, type Pager } from "./Pagination";
import { QuadsEditor, QuadsPackPanel, QuadsPreview } from "./QuadsEditor";
import { TruthsPackPanel, TruthsPreview } from "./TruthsEditor";
import { DrawWordsPanel } from "./DrawWordsPanel";
import { ReviewQueue } from "./ReviewQueue";
import { SortHead, type HeadCol } from "./SortHeader";
import { useUrlFilters, useUrlSort } from "./useUrlFilters";
import { PageHead, StateGuide, StatePill, When, type StateWords } from "./content-ui";
import { Btn, Empty, Field, Notice, Pill, RowsSkeleton, Swatch, Tabs, textareaCls, type PillTone } from "./ui";
import { Select } from "@/components/ui/Select";
import { DateField } from "@/components/ui/DateField";

/** A content game's name in the pickers (a retired game says so). */
const contentGameName = (g: string) => (GAME_BY_ID[g]?.retired ? adminCopy.retired.option(GAME_BY_ID[g].name) : (GAME_BY_ID[g]?.name ?? g));

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
  source?: "editor" | "content_file";
  /** R4-15: in the Quads free-play pool since */
  pooled_at?: string | null;
  author_email?: string | null;
  reviewer_email?: string | null;
}

const LOOK: Record<Item["status"], { tone: PillTone; icon: string }> = {
  draft: { tone: "neutral", icon: "pencil-simple" },
  in_review: { tone: "warn", icon: "hourglass" },
  approved: { tone: "ok", icon: "check-circle" },
  rejected: { tone: "danger", icon: "x-circle" },
  scheduled: { tone: "ok", icon: "calendar-blank" },
};
const itemState = (s: Item["status"]): StateWords => ({ ...adminCopy.content.states[s], ...LOOK[s] });
const ITEM_STATES = (Object.keys(LOOK) as Item["status"][]).map(itemState);

/** A one-line summary of a payload: its first text field. */
function summary(p: unknown): string {
  if (typeof p === "string") return p; // Five: a bare word
  if (!p || typeof p !== "object") return "";
  const o = p as Record<string, unknown>;
  if (typeof o.title === "string" && typeof o.emoji === "string") return `${o.emoji} ${o.title}`; // Emoji Hits
  if (typeof o.lie === "string" && o.lie) return o.lie; // Two Truths: the lie names the round
  for (const k of ["theme", "category", "q", "name", "label", "phrase", "pangram"])
    if (typeof o[k] === "string" && o[k]) return o[k] as string;
  if (Array.isArray(o.words)) return (o.words as string[]).filter(Boolean).join(" ");
  if (Array.isArray(o.groups)) return (o.groups as { label: string }[]).map((g) => g.label).join(" / ");
  if (Array.isArray(o.rows)) return (o.rows as string[]).join(" ");
  if (Array.isArray(o.items)) return C.questions((o.items as unknown[]).length);
  return JSON.stringify(p).slice(0, 80);
}

const C = adminCopy.content;
const E = C.editorPanel;
const { common } = adminCopy;
const FILTERS = { tab: "items", status: "", game: "", show: "todo" } as const;
const ALLOWED = {
  tab: ["items", "review", "drawit"],
  status: ["draft", "in_review", "approved", "rejected", "scheduled"],
  game: CONTENT_GAMES,
  show: [...REVIEW_SHOW],
};
const ITEM_COLS: HeadCol<(typeof CONTENT_SORT.keys)[number]>[] = [
  { label: C.itemsHead[0] },
  { label: C.itemsHead[1], sort: "game" },
  { label: C.itemsHead[2], sort: "status" },
  { label: C.itemsHead[3] },
  { label: C.itemsHead[4], sort: "updated_at" },
];

/**
 * Content editor (FR-AD-03): drafts, two-person review and scheduling; the Review queue of content.ts entries (round 3,
 * item 12); the Family Draw words (round 3, item 11).
 */
export function ContentDesk(props: { canWrite: boolean; canApprove: boolean; canSchedule: boolean }) {
  const [filters, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const tab = filters.tab as "items" | "review" | "drawit";
  const pager = usePager();
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead title={C.title} purpose={C.intro} />
      <div className="relative max-w-full self-start overflow-x-auto">
        <Tabs
          label={C.views}
          value={tab}
          onChange={(t) => setFilters({ tab: t })}
          items={[
            { id: "items", label: C.tabs.items },
            { id: "review", label: C.tabs.review },
            { id: "drawit", label: C.tabs.drawit },
          ]}
        />
      </div>
      <div key={tab} className="admin-fade flex min-w-0 flex-col gap-4">
        {tab === "items" ? (
          <Items {...props} pager={pager} />
        ) : tab === "drawit" ? (
          <DrawWordsPanel canWrite={props.canWrite} />
        ) : (
          <ReviewQueue
            canWrite={props.canWrite}
            canSchedule={props.canSchedule}
            game={(filters.game || null) as ContentGame | null}
            show={filters.show as ReviewShow}
            setFilters={setFilters}
            pager={pager}
          />
        )}
      </div>
    </div>
  );
}

function Items({
  canWrite,
  canApprove,
  canSchedule,
  pager,
}: {
  canWrite: boolean;
  canApprove: boolean;
  canSchedule: boolean;
  pager: Pager;
}) {
  const [{ status, game }, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const sort = useUrlSort(CONTENT_SORT);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const q = useAdminQuery<AdminPage<Item> & { me: string }>(
    ["content", status, game, sort.query, pager.query],
    `/api/admin/content?${status ? `status=${status}&` : ""}${game ? `game=${game}&` : ""}${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  // The open item stays in the editor when its row leaves the current page.
  const [held, setHeld] = useState<Item | undefined>(undefined);
  const found = open && open !== "new" ? q.data?.rows.find((r) => r.id === open) : undefined;
  if (found && found !== held) setHeld(found);
  const item = open && open !== "new" ? (found ?? (held?.id === open ? held : undefined)) : undefined;
  return (
    // The editor column only exists while an item is open, so the list uses the full width otherwise.
    <div className={`grid grid-cols-1 gap-4 ${open ? "xl:grid-cols-[1fr_480px]" : ""}`}>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-muted max-w-[760px] text-[13px]">{C.itemsIntro}</p>
        <StateGuide states={ITEM_STATES} />
        <div className="flex flex-wrap items-end gap-2">
          <Field label={C.status} htmlFor="ci-status">
            <Select
              id="ci-status"
              value={status}
              onValueChange={(v) => setFilters({ status: v })}
              options={[
                { value: "", label: C.anyStatus },
                ...ALLOWED.status.map((s) => ({ value: s, label: itemState(s as Item["status"]).label })),
              ]}
              className="h-11 w-44"
            />
          </Field>
          <Field label={C.game} htmlFor="ci-game">
            <Select
              id="ci-game"
              value={game}
              onValueChange={(v) => setFilters({ game: v })}
              options={[{ value: "", label: common.allGames }, ...CONTENT_GAMES.map((g) => ({ value: g, label: contentGameName(g) }))]}
              className="h-11 w-44"
            />
          </Field>
          {canWrite && (
            <Btn tone="primary" size="lg" icon="plus" className="ml-auto" onClick={() => setOpen("new")}>
              {C.newItem}
            </Btn>
          )}
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
          ) : !q.data.rows.length ? (
            <Empty icon="note-pencil">{status || game ? C.emptyFiltered : C.emptyItems}</Empty>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <SortHead cols={ITEM_COLS} sort={sort} />
              <tbody>
                {q.data.rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-line border-t ${open === r.id ? "bg-[var(--success-tint)]" : "hover:bg-surface-raised/50"}`}
                  >
                    <td className="max-w-[300px] px-3 py-2">
                      <button
                        type="button"
                        aria-expanded={open === r.id}
                        onClick={() => setOpen(r.id)}
                        className="block min-h-11 w-full truncate text-left font-semibold hover:underline"
                      >
                        {summary(r.payload) || C.untitled}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 text-[13px]">
                        <Swatch world={GAME_BY_ID[r.game_id]?.world ?? "word"} />
                        {GAME_BY_ID[r.game_id]?.name ?? r.game_id}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap items-center gap-1">
                        <StatePill s={itemState(r.status)} />
                        {r.pooled_at && <Pill tone="ok">{E.poolPill}</Pill>}
                      </span>
                    </td>
                    <td className="text-muted max-w-[160px] truncate px-3 py-2 text-[13px]">
                      {r.author_id === q.data.me ? C.you : (r.author_email ?? C.editor)}
                    </td>
                    <td className="num text-muted px-3 py-2 text-[13px] whitespace-nowrap">
                      <When iso={r.updated_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {q.data && <Pagination pager={pager} total={q.data.total} />}
        {game === "quads" && <QuadsPackPanel status={status} canWrite={canWrite} />}
        {game === "twotruths" && <TruthsPackPanel status={status} canWrite={canWrite} />}
      </div>
      {open && (
        <Editor
          key={open}
          item={item}
          me={q.data?.me ?? ""}
          canWrite={canWrite}
          canApprove={canApprove}
          canSchedule={canSchedule}
          onCreated={(id) => (setOpen(id), pager.reset())}
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
  const [game, setGame] = useState<ContentGame>((item?.game_id as ContentGame) ?? "quickfire");
  const [text, setText] = useState(() => JSON.stringify(item?.payload ?? TEMPLATES.quickfire, null, 2));
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
  const nextStep = !item
    ? canWrite
      ? E.next.draft
      : null
    : item.status === "in_review" && !mine && canApprove
      ? E.next.reviewer
      : item.status === "rejected" && editable
        ? E.next.rejected
        : item.status === "draft" && editable
          ? E.next.draft
          : null;
  const payloadField = (
    <Field label={E.payload} htmlFor="payload" hint={editable ? E.payloadHint : undefined}>
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
  );

  return (
    <aside aria-label={E.aria} className="bg-surface flex flex-col gap-3 rounded-[12px] p-4 xl:sticky xl:top-5 xl:self-start">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[16px] font-extrabold">
          {item ? E.itemTitle(GAME_BY_ID[item.game_id]?.name ?? item.game_id) : C.newItem}
        </h2>
        {item && <StatePill s={itemState(item.status)} />}
        <Btn size="sm" tone="ghost" icon="x" aria-label={E.close} className="ml-auto" onClick={onClose} />
      </div>
      {!item && (
        <Field label={common.game} htmlFor="game">
          <Select
            id="game"
            value={game}
            onValueChange={(v) => {
              const g = v as ContentGame;
              setGame(g);
              setText(JSON.stringify(TEMPLATES[g], null, 2));
            }}
            options={CONTENT_GAMES.map((g) => ({ value: g, label: contentGameName(g) }))}
            className="w-full"
          />
        </Field>
      )}
      {item && <p className="text-muted text-[13px]">{itemState(item.status).meaning}</p>}
      {item && (
        <span className="text-muted text-[12px]">
          {E.byline(item.author_id === me ? C.you : (item.author_email ?? E.anEditor), item.reviewer_email)}
        </span>
      )}
      {nextStep && <Notice icon="info">{nextStep}</Notice>}
      {game === "quads" && (
        <QuadsEditor value={parsed.ok ? parsed.value : null} readOnly={!editable} onChange={(p) => setText(JSON.stringify(p, null, 2))} />
      )}
      {game === "quads" ? (
        <details>
          <summary className="disclosure text-muted hover:text-text flex min-h-11 cursor-pointer items-center text-[13px] font-semibold">
            {E.payloadFolded}
          </summary>
          {payloadField}
        </details>
      ) : (
        payloadField
      )}
      <div id="payload-issues" aria-live="polite">
        {!parsed.ok ? (
          <Notice tone="danger" icon="warning">
            {E.badJson}
          </Notice>
        ) : check && !check.success ? (
          <ul className="text-danger flex flex-col gap-0.5 text-[13px] font-medium">
            {check.issues.slice(0, 8).map((i, k) => (
              <li key={k}>
                <span className="num">{i.path.join(".") || E.payloadPath}</span>: {i.message}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-accent text-[13px] font-semibold">{E.matches(GAME_BY_ID[game]?.name ?? game)}</span>
        )}
      </div>
      <Field label={E.notes} htmlFor="notes">
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          readOnly={!editable && !(canApprove && !mine)}
          rows={2}
          className={`${textareaCls} resize-y`}
        />
      </Field>
      {game === "quads" && parsed.ok && <QuadsPreview value={parsed.value} />}
      {game === "twotruths" && parsed.ok && <TruthsPreview value={parsed.value} />}
      {err && <Notice tone="danger">{errorText(err)}</Notice>}
      {schedule.data && (
        <Notice tone="ok" icon="check-circle">
          {E.scheduledFor(dayMonth(date))}{" "}
          <Link className="text-accent underline" href={`/admin/calendar/${game}/${date}`}>
            {E.openDaily}
          </Link>
        </Notice>
      )}

      {editable && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Btn
            size="lg"
            disabled={!check?.success || create.isPending || save.isPending}
            onClick={() =>
              item
                ? save.mutate({ payload: parsed.ok ? parsed.value : undefined, notes })
                : create.mutate({ game, payload: parsed.ok ? parsed.value : undefined, notes }, { onSuccess: (r) => onCreated(r.id) })
            }
          >
            {E.saveDraft}
          </Btn>
          <Btn
            size="lg"
            tone="primary"
            disabled={!item || !check?.success || save.isPending || item.status === "in_review"}
            onClick={() => save.mutate({ payload: parsed.ok ? parsed.value : undefined, notes, submit: true })}
          >
            {item?.status === "in_review" ? E.inReview : E.submit}
          </Btn>
        </div>
      )}
      {item?.status === "in_review" && !mine && canApprove && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Btn size="lg" disabled={review.isPending} onClick={() => review.mutate({ decision: "reject", notes })}>
            {E.reject}
          </Btn>
          <Btn size="lg" tone="primary" disabled={review.isPending} onClick={() => review.mutate({ decision: "approve", notes })}>
            {E.approve}
          </Btn>
        </div>
      )}
      {item?.status === "in_review" && mine && <span className="text-muted text-[13px]">{E.waiting}</span>}
      {item?.status === "approved" && canSchedule && (
        <div className="bg-bg flex flex-col gap-2 rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--line)]">
          {!plan ? (
            <span className="text-muted text-[13px]">{E.joinsPool(GAME_BY_ID[game]?.name ?? game)}</span>
          ) : (
            // Guess-route games (Quads, Coil...) schedule too: the guess route checks the attempt's stored puzzle.
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                schedule.mutate({ itemId: item.id, date });
              }}
            >
              <Field label={E.scheduleOn} htmlFor="sched" hint={E.scheduleHelp}>
                <DateField id="sched" min={addDays(todayIso(), 1)} value={date} onChange={setDate} className="w-44" />
              </Field>
              <Btn type="submit" tone="primary" size="lg" disabled={schedule.isPending}>
                {E.schedule}
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
          {E.scheduledLink(dayMonth(item.scheduled_for))}
        </Link>
      )}
      {item && item.game_id === "quads" && item.source !== "content_file" && ["approved", "scheduled"].includes(item.status) && (
        <QuadsPool item={item} canWrite={canWrite} />
      )}
    </aside>
  );
}

/** R4-15: one click puts an approved Quads item in free play (mixed with the built-in boards) or takes it out. */
function QuadsPool({ item, canWrite }: { item: Item; canWrite: boolean }) {
  const pool = useAdminAction<{ pooled: boolean }, Item>("POST", `/api/admin/content/${item.id}/pool`);
  const pooled = pool.data ? !!pool.data.pooled_at : !!item.pooled_at;
  return (
    <section
      aria-label={E.poolTitle}
      className="bg-bg flex flex-col gap-2 rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--line)]"
      data-quads-pool
    >
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold">{E.poolTitle}</h3>
        {pooled && <Pill tone="ok">{E.poolPill}</Pill>}
      </div>
      <p className="text-muted text-[13px]" aria-live="polite">
        {pooled ? E.poolIn : E.poolOut}
      </p>
      {pool.error && <Notice tone="danger">{errorText(pool.error)}</Notice>}
      {canWrite && (
        <Btn tone={pooled ? "secondary" : "primary"} size="lg" disabled={pool.isPending} onClick={() => pool.mutate({ pooled: !pooled })}>
          {pooled ? E.poolRemove : E.poolAdd}
        </Btn>
      )}
    </section>
  );
}
