"use client";

import { useMemo, useState } from "react";
import { GAME_BY_ID } from "@/lib/catalog";
import { SCHEDULABLE, validatePayload, type ContentGame } from "@/lib/admin/content-schemas";
import { REVIEW_SHOW, type EntryState, type ReviewShow } from "@/lib/admin/content-review";
import { age } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, type Pager } from "./Pagination";
import { PracticeBoardPreview } from "./PuzzlePreview";
import { ReviewEntry } from "./ReviewEntry";
import { Btn, Empty, Field, Notice, Pill, RowsSkeleton, Swatch, Tabs, inputCls, textareaCls, type PillTone } from "./ui";

const C = adminCopy.content;
const R = C.review;

interface GameSummary {
  game: ContentGame;
  total: number;
  reviewed: number;
  approved: number;
  edited: number;
  retired: number;
  changed: number;
  pending: number;
  needsReview: boolean;
}
interface Entry {
  index: number;
  entry: unknown;
  edit?: unknown;
  state: EntryState;
  notes: string | null;
  reviewed_at: string | null;
  reviewer: string | null;
}
interface Queue {
  canReview: boolean;
  games: (GameSummary & { entries?: Entry[] })[];
  total?: number;
}

const TONE: Record<EntryState, PillTone> = { pending: "warn", changed: "warn", approved: "ok", edited: "ok", retired: "neutral" };
const nameOf = (g: string) => GAME_BY_ID[g]?.name ?? g;

/** A labelled bar plus the count in words, so progress never relies on the bar alone. */
function Progress({ s, compact = false }: { s: GameSummary; compact?: boolean }) {
  return (
    <span className={`flex flex-col gap-1 ${compact ? "w-24" : "w-full max-w-[320px]"}`}>
      <span
        role="progressbar"
        aria-label={R.progressLabel(nameOf(s.game))}
        aria-valuemin={0}
        aria-valuemax={s.total}
        aria-valuenow={s.reviewed}
        className="bg-surface-raised h-1.5 overflow-hidden rounded-full"
      >
        <span className="bg-accent block h-full" style={{ width: `${s.total ? (100 * s.reviewed) / s.total : 0}%` }} />
      </span>
      <span className="num text-muted text-[12px]">{R.progress(s.reviewed, s.total)}</span>
    </span>
  );
}

/**
 * Content page, Review view (round 3, item 12): per game, the content.ts entries marked needsReview, each drawn as
 * players see it, with Approve, Edit and Retire (Restore for a retired one), a progress counter and filters. Content
 * editors and the owner review (content.write); every Content reader views. The server keeps each decision with who
 * and when, audits it, and leaves retired entries out of every board.
 */
export function ReviewQueue({
  canWrite,
  game,
  show,
  setFilters,
  pager,
}: {
  canWrite: boolean;
  game: ContentGame | null;
  show: ReviewShow;
  setFilters: (f: { game?: string; show?: string }) => void;
  pager: Pager;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [board, setBoard] = useState<number | null>(null);
  const sum = useAdminQuery<Queue>(["review"], "/api/admin/content/files");
  const one = useAdminQuery<Queue>(
    ["review", game, show, q, pager.query],
    game ? `/api/admin/content/files?game=${game}&show=${show}&q=${encodeURIComponent(q)}&${pager.query}` : null,
    { keepPrevious: true },
  );
  const act = useAdminAction<{ game: string; indexes: number[]; decision: "approve" | "retire" }>("POST", "/api/admin/content/files");
  const shown = one.data?.games[0]?.game === game ? one.data : undefined;
  const entries = shown?.games[0]?.entries ?? [];
  const summary = shown?.games[0];
  const can = canWrite && (sum.data?.canReview ?? true);
  const decide = (indexes: number[], decision: "approve" | "retire") =>
    act.mutate({ game: game!, indexes, decision }, { onSuccess: () => setPicked(new Set()) });
  const pick = (g: string) => {
    setFilters({ game: g });
    setPicked(new Set());
    setEditing(null);
    setBoard(null);
    pager.reset();
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      <nav aria-label={R.games} className="bg-surface flex flex-col gap-1 self-start rounded-[12px] p-2">
        {sum.isPending ? (
          <RowsSkeleton rows={8} />
        ) : sum.error ? (
          <Notice tone="danger">{errorText(sum.error)}</Notice>
        ) : (
          sum.data.games.map((g) => (
            <button
              key={g.game}
              type="button"
              aria-pressed={game === g.game}
              onClick={() => pick(g.game)}
              className={`flex min-h-14 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[14px] font-semibold ${game === g.game ? "bg-surface-raised" : "hover:bg-surface-raised/60"}`}
            >
              <Swatch world={GAME_BY_ID[g.game]?.world ?? "word"} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{nameOf(g.game)}</span>
                <Pill tone={g.needsReview ? "warn" : "ok"} className="w-fit">
                  {g.needsReview ? R.needsReview : R.reviewed}
                </Pill>
              </span>
              <Progress s={g} compact />
            </button>
          ))
        )}
      </nav>
      <div className="flex min-w-0 flex-col gap-3">
        {!can && <Notice icon="info">{R.readOnly}</Notice>}
        {!game ? (
          <Notice icon="info">
            {R.intro} {R.pick}
          </Notice>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[18px] font-extrabold">{nameOf(game)}</h2>
              {summary && <Progress s={summary} />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                label={C.show}
                value={show}
                onChange={(v) => (setFilters({ show: v }), setPicked(new Set()), pager.reset())}
                items={REVIEW_SHOW.map((id) => ({ id, label: R.showTabs[id] }))}
              />
              <input
                type="search"
                aria-label={R.search}
                placeholder={R.search}
                value={q}
                onChange={(e) => (setQ(e.target.value), pager.reset())}
                className={`${inputCls} w-56`}
              />
              {can && (
                <div className="ml-auto flex gap-2">
                  <Btn disabled={!picked.size || act.isPending} onClick={() => decide([...picked], "retire")}>
                    {R.retireAll(picked.size)}
                  </Btn>
                  <Btn tone="primary" disabled={!picked.size || act.isPending} onClick={() => decide([...picked], "approve")}>
                    {R.approveAll(picked.size)}
                  </Btn>
                </div>
              )}
            </div>
            {act.error && <Notice tone="danger">{errorText(act.error)}</Notice>}
            {one.error ? (
              <Notice tone="danger">{errorText(one.error)}</Notice>
            ) : !shown ? (
              <RowsSkeleton />
            ) : !entries.length ? (
              <Empty>{show === "todo" && !summary?.needsReview ? R.allDone(nameOf(game)) : R.nothingHere(nameOf(game))}</Empty>
            ) : (
              <>
                {can && (
                  <label className="flex min-h-11 w-fit items-center gap-2 text-[14px]">
                    <input
                      type="checkbox"
                      checked={entries.every((e) => picked.has(e.index))}
                      onChange={(ev) => {
                        const n = new Set(picked);
                        for (const x of entries) {
                          if (ev.target.checked) n.add(x.index);
                          else n.delete(x.index);
                        }
                        setPicked(n);
                      }}
                      className="size-5 accent-[var(--accent)]"
                    />
                    {R.selectAll}
                  </label>
                )}
                <ul className="flex flex-col gap-2" aria-label={R.games}>
                  {entries.map((e) => (
                    <li key={e.index} className="bg-surface flex flex-col gap-2 rounded-[12px] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {can && (
                          <input
                            type="checkbox"
                            aria-label={R.selectEntry(e.index)}
                            checked={picked.has(e.index)}
                            onChange={(ev) => {
                              const n = new Set(picked);
                              if (ev.target.checked) n.add(e.index);
                              else n.delete(e.index);
                              setPicked(n);
                            }}
                            className="size-5 accent-[var(--accent)]"
                          />
                        )}
                        <span className="num text-muted text-[13px]">{R.entry(e.index)}</span>
                        <Pill tone={TONE[e.state]}>{R.states[e.state]}</Pill>
                        {e.reviewer && e.reviewed_at && (
                          <span className="text-muted text-[12px]">
                            {R.by(e.reviewer === "you" ? C.you : e.reviewer, age(e.reviewed_at))}
                          </span>
                        )}
                        <div className="ml-auto flex flex-wrap gap-1.5">
                          {SCHEDULABLE[game] && (
                            <Btn size="sm" tone="ghost" icon="eye" aria-label={R.boardEntry(e.index)} onClick={() => setBoard(e.index)}>
                              {R.board}
                            </Btn>
                          )}
                          {can && (
                            <>
                              <Btn size="sm" icon="pencil-simple" aria-label={R.editEntry(e.index)} onClick={() => setEditing(e.index)}>
                                {R.edit}
                              </Btn>
                              {e.state !== "retired" && (
                                <Btn
                                  size="sm"
                                  aria-label={R.retireEntry(e.index)}
                                  disabled={act.isPending}
                                  onClick={() => decide([e.index], "retire")}
                                >
                                  {R.retire}
                                </Btn>
                              )}
                              {e.state !== "approved" && (
                                <Btn
                                  size="sm"
                                  tone="primary"
                                  aria-label={e.state === "retired" ? R.restoreEntry(e.index) : R.approveEntry(e.index)}
                                  disabled={act.isPending}
                                  onClick={() => decide([e.index], "approve")}
                                >
                                  {e.state === "retired" ? R.restore : R.approve}
                                </Btn>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`grid grid-cols-1 gap-3 ${e.edit !== undefined ? "md:grid-cols-2" : ""}`}>
                        {e.edit !== undefined ? (
                          <>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted text-[12px] font-semibold">{R.asEdited}</span>
                              <ReviewEntry game={game} value={e.edit} />
                            </div>
                            <div className="flex flex-col gap-1 opacity-70">
                              <span className="text-muted text-[12px] font-semibold">{R.code}</span>
                              <ReviewEntry game={game} value={e.entry} />
                            </div>
                          </>
                        ) : (
                          <ReviewEntry game={game} value={e.entry} />
                        )}
                      </div>
                      {e.notes && <p className="text-muted text-[13px]">{e.notes}</p>}
                      {editing === e.index && <EditEntry game={game} entry={e} onDone={() => setEditing(null)} />}
                      {board === e.index && <BoardPreview game={game} index={e.index} onClose={() => setBoard(null)} />}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {shown?.total !== undefined && <Pagination pager={pager} total={shown.total} />}
          </>
        )}
      </div>
    </div>
  );
}

function EditEntry({ game, entry, onDone }: { game: ContentGame; entry: Entry; onDone: () => void }) {
  const [text, setText] = useState(() => JSON.stringify(entry.edit ?? entry.entry, null, 2));
  const [notes, setNotes] = useState("");
  const save = useAdminAction<{ game: string; index: number; payload: unknown; notes?: string }>("POST", "/api/admin/content/files/edit");
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false as const };
    }
  }, [text]);
  const check = parsed.ok ? validatePayload(game, parsed.value) : null;
  const id = `review-edit-${entry.index}`;
  return (
    <form
      aria-label={R.editTitle(entry.index)}
      className="bg-bg flex flex-col gap-2 rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--line)]"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (parsed.ok) save.mutate({ game, index: entry.index, payload: parsed.value, notes: notes || undefined }, { onSuccess: onDone });
      }}
    >
      <span className="text-[14px] font-semibold">{R.editTitle(entry.index)}</span>
      <p className="text-muted text-[13px]">{R.editHint}</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Field label={R.editField} htmlFor={id}>
          <textarea
            id={id}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            rows={12}
            spellCheck={false}
            aria-invalid={!check?.success}
            aria-describedby={`${id}-issues`}
            className={`${textareaCls} num resize-y text-[13px]`}
          />
        </Field>
        {parsed.ok && <ReviewEntry game={game} value={parsed.value} />}
      </div>
      <div id={`${id}-issues`} aria-live="polite">
        {!parsed.ok ? (
          <Notice tone="danger" icon="warning">
            {R.badJson}
          </Notice>
        ) : check && !check.success ? (
          <ul className="text-danger flex flex-col gap-0.5 text-[13px] font-medium">
            {check.issues.slice(0, 8).map((i, k) => (
              <li key={k}>
                <span className="num">{i.path.join(".") || "entry"}</span>: {i.message}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-accent text-[13px] font-semibold">{R.matches(nameOf(game))}</span>
        )}
      </div>
      <Field label={R.notes} htmlFor={`${id}-notes`}>
        <input id={`${id}-notes`} value={notes} maxLength={2000} onChange={(ev) => setNotes(ev.target.value)} className={inputCls} />
      </Field>
      {save.error && <Notice tone="danger">{errorText(save.error)}</Notice>}
      <div className="flex gap-2">
        <Btn size="lg" onClick={onDone}>
          {R.cancel}
        </Btn>
        <Btn type="submit" size="lg" tone="primary" disabled={!check?.success || save.isPending}>
          {R.saveEdit}
        </Btn>
      </div>
    </form>
  );
}

function BoardPreview({ game, index, onClose }: { game: ContentGame; index: number; onClose: () => void }) {
  const q = useAdminQuery<{ board: { puzzle: unknown; solution: unknown } | null }>(
    ["review-board", game, index],
    `/api/admin/content/files/preview?game=${game}&index=${index}`,
  );
  return (
    <section aria-label={R.boardTitle(index)} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold">{R.boardTitle(index)}</span>
        <Btn size="sm" tone="ghost" icon="x" aria-label={R.close} className="ml-auto" onClick={onClose} />
      </div>
      <p className="text-muted text-[13px]">{R.boardHint}</p>
      {q.isPending ? (
        <RowsSkeleton rows={4} />
      ) : q.error ? (
        <Notice tone="danger">{errorText(q.error)}</Notice>
      ) : q.data.board ? (
        <PracticeBoardPreview game={game} puzzle={q.data.board.puzzle} solution={q.data.board.solution} />
      ) : null}
    </section>
  );
}
