"use client";

import { useMemo, useState } from "react";
import { adminCopy } from "@/lib/copy/admin";
import { adultPartyCopy } from "@/lib/copy/adult-party";
import type { DrawWord } from "@/lib/party-adult/content";
import { familyOptions } from "@/lib/party-adult/family";
import { activeRows, rowToWord } from "@/lib/party-adult/family-list";
import { drawPackDiff, drawPackToJson, parseDrawPack } from "@/lib/admin/draw-pack";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { api } from "@/lib/client/api";
import { PackPanel } from "./PackPanel";
import { Btn, Empty, Field, Notice, Pill, RowsSkeleton, Tabs, inputCls } from "./ui";

const W = adminCopy.content.drawit;

interface WordRow {
  id: string;
  word: string;
  alt: string[];
  sort: number;
  retired_at: string | null;
}
interface WordList {
  rows: WordRow[];
  active: number;
  min: number;
  source: "db" | "code";
}
interface ImportResult {
  added: string[];
  updated: string[];
  restored: string[];
  retired: string[];
}

/** "a, b ,c" to ["a", "b", "c"] (the server checks and tidies each name). */
const names = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const rand = (n: number) => Math.floor(Math.random() * n);

/**
 * Content page, Family Draw words tab (round 3, item 11; R2-P5 before): the 16+ Draw It word list stored in
 * public.family_draw_words, which rounds deal from. Content editors and the owner add, edit, retire and restore words
 * and import packs (every write audited, the server checks each word); every role that can open Content sees the
 * list, previews a word as guessers get it, and exports or checks a pack.
 */
export function DrawWordsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<WordList>(["drawwords"], "/api/admin/content/draw-words");
  const [find, setFind] = useState("");
  const [show, setShow] = useState<"active" | "retired" | "all">("active");
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [retireMissing, setRetireMissing] = useState(false);
  const patch = useAdminAction<{ id: string; word?: string; alt?: string[]; retired?: boolean }, WordRow>(
    "PATCH",
    (i) => `/api/admin/content/draw-words/${i.id}`,
  );

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const live: DrawWord[] = useMemo(() => activeRows(rows).map(rowToWord), [rows]);
  const shown = useMemo(() => {
    const k = find.trim().toLowerCase();
    return rows
      .filter((r) => (show === "all" ? true : show === "retired" ? !!r.retired_at : !r.retired_at))
      .filter((r) => !k || [r.word, ...r.alt].some((x) => x.includes(k)));
  }, [rows, find, show]);

  if (q.isPending) return <RowsSkeleton />;
  if (q.error) return <Notice tone="danger">{errorText(q.error)}</Notice>;
  const { active, min, source } = q.data;
  const atMin = active <= min;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-[14px]">
        {W.intro(active)} {W.minNote(min)}
      </p>
      {source === "code" && (
        <Notice tone="warn" icon="warning">
          {W.fallback}
        </Notice>
      )}
      {!canWrite && <Notice icon="info">{W.readOnly}</Notice>}
      {canWrite && <AddWord />}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={W.search}
          placeholder={W.search}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          className={`${inputCls} w-64`}
        />
        <Tabs
          label={W.show}
          value={show}
          onChange={setShow}
          items={[
            { id: "active", label: W.showTabs.active },
            { id: "retired", label: W.showTabs.retired },
            { id: "all", label: W.showTabs.all },
          ]}
        />
        <span className="num text-muted text-[13px]" aria-live="polite">
          {W.count(shown.length, rows.length)}
        </span>
      </div>
      {patch.error && <Notice tone="danger">{errorText(patch.error)}</Notice>}
      {preview && live.some((w) => w.word === preview) && <Preview word={preview} list={live} onClose={() => setPreview(null)} />}
      {!shown.length ? (
        <Empty icon="magnifying-glass">{W.emptyList}</Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3" aria-label={W.title}>
          {shown.map((r) =>
            editing === r.id ? (
              <EditWord key={r.id} row={r} onDone={() => setEditing(null)} />
            ) : (
              <li key={r.id} className="bg-surface flex min-h-11 items-center gap-2 rounded-[10px] py-1.5 pr-1.5 pl-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold capitalize">
                    {r.word}
                    {r.retired_at && <Pill>{W.retiredPill}</Pill>}
                  </span>
                  {r.alt.length ? <span className="text-muted truncate text-[12px]">{W.also(r.alt.join(", "))}</span> : null}
                </span>
                {!r.retired_at && (
                  <Btn size="sm" tone="ghost" icon="eye" aria-label={W.previewWord(r.word)} onClick={() => setPreview(r.word)} />
                )}
                {canWrite && (
                  <>
                    <Btn size="sm" tone="ghost" icon="pencil-simple" aria-label={W.editWord(r.word)} onClick={() => setEditing(r.id)} />
                    {r.retired_at ? (
                      <Btn
                        size="sm"
                        tone="ghost"
                        aria-label={W.restoreWord(r.word)}
                        disabled={patch.isPending}
                        onClick={() => patch.mutate({ id: r.id, retired: false })}
                      >
                        {W.restore}
                      </Btn>
                    ) : (
                      <Btn
                        size="sm"
                        tone="ghost"
                        aria-label={W.retireWord(r.word)}
                        disabled={patch.isPending || atMin}
                        title={atMin ? W.minNote(min) : undefined}
                        onClick={() => patch.mutate({ id: r.id, retired: true })}
                      >
                        {W.retire}
                      </Btn>
                    )}
                  </>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      <PackPanel
        id="drawit"
        words={canWrite ? W : { ...W, importPack: W.checkPack, importGo: W.checkGo }}
        canWrite={canWrite}
        check={parseDrawPack}
        checked={(items) => {
          const d = drawPackDiff(live, items);
          return W.checked(items.length, d.added, d.dropped);
        }}
        submit={
          canWrite
            ? async (text) => {
                const r = await api<ImportResult>("/api/admin/content/draw-words/import", {
                  method: "POST",
                  json: { text, retireMissing },
                });
                await q.refetch();
                return W.imported(r);
              }
            : undefined
        }
        exportPack={async () => ({ file: "spuzl-family-draw-words.json", text: drawPackToJson(live), note: W.exported(live.length) })}
      >
        {canWrite && (
          <label className="flex min-h-11 items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={retireMissing}
              onChange={(e) => setRetireMissing(e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
            {W.retireMissing}
          </label>
        )}
      </PackPanel>
    </div>
  );
}

function AddWord() {
  const [word, setWord] = useState("");
  const [alt, setAlt] = useState("");
  const add = useAdminAction<{ word: string; alt: string[] }, WordRow>("POST", "/api/admin/content/draw-words");
  return (
    <form
      className="bg-surface flex flex-col gap-2 rounded-[12px] p-3"
      aria-label={W.add}
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate({ word, alt: names(alt) }, { onSuccess: () => (setWord(""), setAlt("")) });
      }}
    >
      <span className="text-[14px] font-semibold">{W.add}</span>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
        <Field label={W.word} htmlFor="dw-word" hint={W.wordHint}>
          <input id="dw-word" value={word} onChange={(e) => setWord(e.target.value)} maxLength={30} className={`${inputCls} w-full`} />
        </Field>
        <Field label={W.alt} htmlFor="dw-alt" hint={W.altHint}>
          <input id="dw-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} className={`${inputCls} w-full`} />
        </Field>
        <Btn type="submit" tone="primary" size="lg" icon="plus" disabled={!word.trim() || add.isPending}>
          {W.addGo}
        </Btn>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {add.error ? (
          <Notice tone="danger">{errorText(add.error)}</Notice>
        ) : add.data ? (
          <Notice tone="ok" icon="check-circle">
            {W.added(add.data.word)}
          </Notice>
        ) : null}
      </div>
    </form>
  );
}

function EditWord({ row, onDone }: { row: WordRow; onDone: () => void }) {
  const [word, setWord] = useState(row.word);
  const [alt, setAlt] = useState(row.alt.join(", "));
  const save = useAdminAction<{ word: string; alt: string[] }, WordRow>("PATCH", `/api/admin/content/draw-words/${row.id}`);
  const id = `dw-${row.id}`;
  return (
    <li className="bg-surface flex flex-col gap-2 rounded-[10px] p-2.5 sm:col-span-2 xl:col-span-3">
      <form
        className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-end"
        aria-label={W.editWord(row.word)}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ word, alt: names(alt) }, { onSuccess: onDone });
        }}
      >
        <Field label={W.word} htmlFor={`${id}-w`}>
          <input id={`${id}-w`} value={word} onChange={(e) => setWord(e.target.value)} maxLength={30} className={`${inputCls} w-full`} />
        </Field>
        <Field label={W.alt} htmlFor={`${id}-a`}>
          <input id={`${id}-a`} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} className={`${inputCls} w-full`} />
        </Field>
        <Btn size="lg" onClick={onDone}>
          {W.cancel}
        </Btn>
        <Btn type="submit" tone="primary" size="lg" disabled={!word.trim() || save.isPending}>
          {W.save}
        </Btn>
      </form>
      {save.error && <Notice tone="danger">{errorText(save.error)}</Notice>}
    </li>
  );
}

/** A round's pick card as guessers see it (components/multiplayer/adult-party.tsx PickBox), from the active list. */
function Preview({ word, list, onClose }: { word: string; list: readonly DrawWord[]; onClose: () => void }) {
  const [deal, setDeal] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deal` re-shuffles on purpose
  const options = useMemo(() => familyOptions(word, rand, list), [word, list, deal]);
  const P = adultPartyCopy.draw;
  return (
    <section aria-label={W.preview} className="bg-surface flex flex-col gap-2 rounded-[12px] p-3">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold">{W.preview}</span>
        <Btn size="sm" tone="ghost" icon="shuffle" className="ml-auto" onClick={() => setDeal((d) => d + 1)}>
          {W.shuffle}
        </Btn>
        <Btn size="sm" tone="ghost" icon="x" aria-label={W.cancel} onClick={onClose} />
      </div>
      <p className="text-muted text-[13px]">{W.previewHint(word)}</p>
      <div className="bg-bg flex max-w-[420px] flex-col gap-1.5 rounded-[16px] p-3">
        <p className="text-[15px] font-semibold">{P.pickLabel}</p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((w) => (
            <span
              key={w}
              className={`bg-surface-raised flex min-h-12 items-center justify-center rounded-[14px] px-3 text-[16px] font-semibold capitalize shadow-[0_4px_0_var(--depth)] ${w === word ? "outline-accent outline-2" : ""}`}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
