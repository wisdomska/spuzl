"use client";

import Link from "next/link";
import { useState } from "react";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { GAME_BY_ID } from "@/lib/catalog";
import { COPY_MAX, TAGS, durationLabel, validateCopyLine, type GameMetaRow, type Tag } from "@/lib/games-meta";
import { adminCopy } from "@/lib/copy/admin";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { hasLogic } from "@/games/logic-ids";
import { PracticeBoardPreview } from "./PuzzlePreview";
import { Btn, Notice, PageTitle, Pill, RowsSkeleton, inputCls } from "./ui";

const C = adminCopy.library;

type Row = Omit<GameMetaRow, "rule" | "blurb"> & {
  id: string;
  rule: string;
  blurb: string;
  default: GameMetaRow & { rule: string; blurb: string };
  overridden: boolean;
  ruleOverridden?: boolean;
  blurbOverridden?: boolean;
  retired?: boolean;
  lab?: boolean;
  labOn?: boolean;
};
type Patch = { typicalSec?: number | null; tags?: Tag[] | null; rule?: string | null; blurb?: string | null };

/**
 * Admin: Library duration chip, filter tags, one-line rule and card copy per game (SPZ-14, R2-ADMIN), with each
 * game's icon as a preview. Validated here and on the server; every change is audited (game_meta.update).
 */
export function LibraryMetaPage({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<{ rows: Row[]; export: Record<string, unknown> }>(["games-meta"], "/api/admin/games/meta");
  const patch = useAdminAction<{ id: string } & Patch>("PATCH", "/api/admin/games/meta");
  const imp = useAdminAction<{ rows: Record<string, unknown> }>("PUT", "/api/admin/games/meta");
  const [json, setJson] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title={C.title}>
        <span className="text-muted text-[14px]">{C.intro}</span>
      </PageTitle>
      {(patch.error || imp.error) && <Notice tone="danger">{errorText((patch.error ?? imp.error)!)}</Notice>}
      {q.isPending && <RowsSkeleton />}
      {q.data && (
        <section className="bg-surface flex flex-col rounded-[16px] p-4">
          {q.data.rows.map((r) => (
            <MetaRow
              key={r.id}
              row={r}
              canWrite={canWrite && !r.retired}
              busy={patch.isPending}
              onSave={(p) => patch.mutate({ id: r.id, ...p })}
            />
          ))}
        </section>
      )}
      <section className="bg-surface flex flex-col gap-2.5 rounded-[16px] p-4">
        <h2 className="text-[15px] font-semibold">{C.exportImport}</h2>
        <p className="text-muted text-[13px]">{C.exportIntro}</p>
        <div className="flex gap-2">
          <Btn tone="secondary" onClick={() => setJson(JSON.stringify({ rows: q.data?.export ?? {} }, null, 2))}>
            {C.export}
          </Btn>
          <Btn
            disabled={!canWrite || imp.isPending || !json}
            onClick={() => {
              try {
                const parsed = JSON.parse(json);
                setParseErr(null);
                imp.mutate(parsed);
              } catch {
                setParseErr(C.badJson);
              }
            }}
          >
            {C.import}
          </Btn>
        </div>
        {parseErr && <Notice tone="danger">{parseErr}</Notice>}
        <textarea
          aria-label={C.jsonAria}
          className={`${inputCls} num min-h-40 font-mono text-[13px]`}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </section>
    </div>
  );
}

function MetaRow({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: (p: Patch) => void }) {
  const [sec, setSec] = useState(String(row.typicalSec));
  const n = Number(sec);
  const bad = !Number.isInteger(n) || n < 10 || n > 3600;
  const toggle = (t: Tag) => onSave({ tags: row.tags.includes(t) ? row.tags.filter((x) => x !== t) : [...row.tags, t] });
  const meta = GAME_BY_ID[row.id];
  const name = meta?.name ?? row.id;
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--line)] py-2.5 first-of-type:border-0" data-meta-row={row.id}>
      <div className="flex flex-wrap items-center gap-3">
        {meta && (
          <span role="img" aria-label={C.iconAria(name)} className="shrink-0">
            <GameIcon3D meta={meta} size={40} />
          </span>
        )}
        <div className="min-w-[160px] flex-1">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            {name}
            {row.retired && <Pill tone="neutral">{adminCopy.retired.pill}</Pill>}
            {row.lab && <Pill tone={row.labOn ? "ok" : "warn"}>{row.labOn ? C.labOn : C.labOff}</Pill>}
          </p>
          <p className="text-muted text-[12px]">
            {row.retired
              ? adminCopy.retired.libraryNote
              : C.rowNote(row.overridden, durationLabel(row.default.typicalSec), row.default.tags)}
          </p>
          {row.lab && (
            <p className="text-muted text-[12px]" data-lab-state={row.labOn ? "on" : "off"}>
              {C.labNote(!!row.labOn)}{" "}
              <Link href="/admin/settings" className="hover:text-text font-semibold underline">
                {C.labSwitch}
              </Link>
            </p>
          )}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!bad) onSave({ typicalSec: n });
          }}
        >
          <label className="sr-only" htmlFor={`sec-${row.id}`}>
            {C.secondsAria(row.id)}
          </label>
          <input
            id={`sec-${row.id}`}
            className={`${inputCls} num w-24`}
            inputMode="numeric"
            value={sec}
            onChange={(e) => setSec(e.target.value)}
            aria-invalid={bad}
            disabled={!canWrite}
          />
          <span className="text-muted text-[12px]">{C.secondsUnit}</span>
          {/* type submit: the shared Btn defaults to a plain button, which would never submit this form */}
          <Btn type="submit" tone="secondary" disabled={!canWrite || busy || bad || n === row.typicalSec}>
            {C.save}
          </Btn>
        </form>
        <div className="flex gap-1.5">
          {TAGS.map((t) => (
            <Btn
              key={t}
              tone={row.tags.includes(t) ? "primary" : "secondary"}
              disabled={!canWrite || busy}
              onClick={() => toggle(t)}
              aria-pressed={row.tags.includes(t)}
            >
              {t}
            </Btn>
          ))}
        </div>
        {row.overridden && (
          <Btn
            tone="secondary"
            disabled={!canWrite || busy}
            onClick={() => onSave({ typicalSec: null, tags: null, rule: null, blurb: null })}
          >
            {C.reset}
          </Btn>
        )}
      </div>
      <details className="group" data-copy-editor>
        <summary className="text-muted hover:text-text flex h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold">
          {C.copy}
          {(row.ruleOverridden || row.blurbOverridden) && <Pill tone="warn">{C.changed}</Pill>}
        </summary>
        <div role="group" aria-label={C.copyAria(name)} className="flex flex-col gap-3 pb-1">
          <CopyLine
            id={`rule-${row.id}`}
            label={C.rule}
            help={C.ruleHelp}
            value={row.rule}
            fallback={row.default.rule}
            overridden={!!row.ruleOverridden}
            canWrite={canWrite}
            busy={busy}
            what="The rule"
            onSave={(v) => onSave({ rule: v })}
          />
          <CopyLine
            id={`blurb-${row.id}`}
            label={C.blurb}
            help={C.blurbHelp}
            value={row.blurb}
            fallback={row.default.blurb}
            overridden={!!row.blurbOverridden}
            canWrite={canWrite}
            busy={busy}
            what="The card copy"
            onSave={(v) => onSave({ blurb: v })}
          />
        </div>
      </details>
      {!row.retired && hasLogic(row.id) && <PracticeBoard id={row.id} />}
    </div>
  );
}

/** The game's practice board, read only, loaded when opened (R2-07; the per-game off switch is on Settings). */
function PracticeBoard({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useAdminQuery<{ puzzle: unknown; solution: unknown; off: boolean; seed: string }>(
    ["games-practice", id],
    open ? `/api/admin/games/practice?game=${encodeURIComponent(id)}` : null,
  );
  return (
    <details data-practice-preview onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="text-muted hover:text-text flex h-11 cursor-pointer items-center gap-2 text-[13px] font-semibold">
        {C.practice}
        {q.data && <Pill tone={q.data.off ? "warn" : "ok"}>{q.data.off ? C.practiceOff : C.practiceOn}</Pill>}
      </summary>
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-muted text-[12px]">{C.practiceIntro}</p>
        {q.isPending && open && <RowsSkeleton rows={1} height={120} />}
        {q.error && <Notice tone="danger">{errorText(q.error)}</Notice>}
        {q.data && <PracticeBoardPreview game={id} puzzle={q.data.puzzle} solution={q.data.solution} />}
      </div>
    </details>
  );
}

/** One line of game copy: a text field with a live character count, the default, Save and Use default. */
function CopyLine({
  id,
  label,
  help,
  value,
  fallback,
  overridden,
  canWrite,
  busy,
  what,
  onSave,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  fallback: string;
  overridden: boolean;
  canWrite: boolean;
  busy: boolean;
  what: string;
  /** null resets to the default */
  onSave: (v: string | null) => void;
}) {
  const [text, setText] = useState(value);
  const problem = validateCopyLine(text, what);
  const len = text.trim().length;
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!problem && text !== value) onSave(text);
      }}
    >
      <label htmlFor={id} className="num text-muted text-[12px] font-semibold">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          className={`${inputCls} min-w-0 flex-1`}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[\r\n]+/g, " "))}
          aria-invalid={!!problem}
          aria-describedby={`${id}-help ${id}-count`}
          disabled={!canWrite}
        />
        <Btn type="submit" tone="secondary" disabled={!canWrite || busy || !!problem || text === value}>
          {C.save}
        </Btn>
        {overridden && (
          <Btn
            tone="ghost"
            disabled={!canWrite || busy}
            onClick={() => {
              setText(fallback);
              onSave(null);
            }}
          >
            {C.resetCopy}
          </Btn>
        )}
      </div>
      <span id={`${id}-count`} className={`num text-[12px] ${problem ? "text-danger" : "text-muted"}`} aria-live="polite">
        {problem ?? C.chars(len, COPY_MAX)}
      </span>
      <span id={`${id}-help`} className="text-muted text-[12px]">
        {help} {overridden ? C.copyDefault(fallback) : ""}
      </span>
    </form>
  );
}
