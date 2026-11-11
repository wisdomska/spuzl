"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { GAME_BY_ID } from "@/lib/catalog";
import { COPY_MAX, TAGS, TYPICAL_SCORE_MAX, durationLabel, validateCopyLine, type GameMetaRow, type Tag } from "@/lib/games-meta";
import { durationWords } from "@/lib/admin/content-words";
import { adminCopy } from "@/lib/copy/admin";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { hasLogic } from "@/games/logic-ids";
import { PracticeBoardPreview } from "./PuzzlePreview";
import { PageHead, StateGuide, StatePill, TechDetails, TechLine, type StateWords } from "./content-ui";
import { Btn, Empty, Notice, Pill, RowsSkeleton, Tabs, inputCls, textareaCls } from "./ui";

const C = adminCopy.library;

type Row = Omit<GameMetaRow, "rule" | "blurb"> & {
  id: string;
  rule: string;
  blurb: string;
  default: GameMetaRow & { rule: string; blurb: string };
  overridden: boolean;
  ruleOverridden?: boolean;
  blurbOverridden?: boolean;
  /** a game scored on points: it has a Daily Five typical score (owner decision S) */
  scored?: boolean;
  scoreOverridden?: boolean;
  retired?: boolean;
  lab?: boolean;
  labOn?: boolean;
};
type Patch = {
  typicalSec?: number | null;
  tags?: Tag[] | null;
  rule?: string | null;
  blurb?: string | null;
  typicalScore?: number | null;
};
type Show = keyof typeof C.showTabs;

const STATES: Record<"live" | "labOn" | "labOff" | "retired", StateWords> = {
  live: { ...C.states.live, tone: "ok", icon: "check-circle" },
  labOn: { ...C.states.labOn, tone: "ok", icon: "flask" },
  labOff: { ...C.states.labOff, tone: "warn", icon: "flask" },
  retired: { ...C.states.retired, tone: "neutral", icon: "prohibit" },
};
const stateOf = (r: Row) => (r.retired ? "retired" : r.lab ? (r.labOn ? "labOn" : "labOff") : "live");
const kindOf = (r: Row): Exclude<Show, "all"> => (r.retired ? "retired" : r.lab ? "lab" : "live");
const nameOf = (id: string) => GAME_BY_ID[id]?.name ?? id;

/**
 * Admin Games page (was Library; SPZ-14, R2-ADMIN): per game, the play time on its card, its filter tags, its
 * one-line rule and card line, with the game's icon, its state for players and its practice round. Validated here
 * and on the server; every change is audited (game_meta.update).
 */
export function LibraryMetaPage({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<{ rows: Row[]; export: Record<string, unknown> }>(["games-meta"], "/api/admin/games/meta");
  const patch = useAdminAction<{ id: string } & Patch>("PATCH", "/api/admin/games/meta");
  const [find, setFind] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [savedId, setSavedId] = useState<string | null>(null);

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const counts = useMemo(() => {
    const c: Record<Show, number> = { all: rows.length, live: 0, lab: 0, retired: 0 };
    for (const r of rows) c[kindOf(r)]++;
    return c;
  }, [rows]);
  const shown = useMemo(() => {
    const k = find.trim().toLowerCase();
    return rows.filter((r) => (show === "all" || kindOf(r) === show) && (!k || nameOf(r.id).toLowerCase().includes(k)));
  }, [rows, find, show]);

  const save = (id: string, p: Patch) => {
    setSavedId(null);
    patch.mutate({ id, ...p }, { onSuccess: () => setSavedId(id) });
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead title={C.title} purpose={C.intro} />
      {!canWrite && <Notice icon="info">{C.readOnly}</Notice>}
      <StateGuide states={Object.values(STATES)} />
      <div aria-live="polite" className="empty:hidden">
        {patch.error ? (
          <Notice tone="danger" icon="warning">
            {errorText(patch.error)}
          </Notice>
        ) : savedId ? (
          <Notice tone="ok" icon="check-circle">
            {C.savedNote(nameOf(savedId))}
          </Notice>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted text-[12px] font-semibold">{C.find}</span>
          <input
            type="search"
            value={find}
            placeholder={C.findPlaceholder}
            onChange={(e) => setFind(e.target.value)}
            className={`${inputCls} h-11 w-64 max-w-full`}
          />
        </label>
        <Tabs<Show>
          label={C.show}
          value={show}
          onChange={setShow}
          items={(Object.keys(C.showTabs) as Show[]).map((id) => ({ id, label: C.showTabs[id], count: counts[id] }))}
        />
        {q.data && (
          <span className="num text-muted ml-auto text-[13px]" aria-live="polite">
            {C.count(shown.length, rows.length)}
          </span>
        )}
      </div>
      {q.isPending ? (
        <RowsSkeleton rows={6} height={96} />
      ) : q.error ? (
        <Notice tone="danger" icon="warning">
          {C.loadError} {errorText(q.error)}
        </Notice>
      ) : !shown.length ? (
        <div className="bg-surface rounded-[16px]">
          <Empty icon="magnifying-glass">{C.empty}</Empty>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <li key={r.id}>
              <MetaRow row={r} canWrite={canWrite && !r.retired} busy={patch.isPending} onSave={(p) => save(r.id, p)} />
            </li>
          ))}
        </ul>
      )}
      <Backup canWrite={canWrite} data={q.data?.export} />
    </div>
  );
}

/** Backup and restore of this page's changes (JSON), folded away: only overrides are copied, every row checked on restore. */
function Backup({ canWrite, data }: { canWrite: boolean; data?: Record<string, unknown> }) {
  const imp = useAdminAction<{ rows: Record<string, unknown> }>("PUT", "/api/admin/games/meta");
  const [json, setJson] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  return (
    <details className="group bg-surface rounded-[16px] px-4 md:px-5">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-[15px] font-semibold">
        {C.backup}
        <span className="text-muted ml-auto text-[12px] font-medium group-open:hidden">{adminCopy.contentCommon.technical}</span>
      </summary>
      <div className="flex flex-col gap-2.5 pb-4">
        <p className="text-muted text-[13px]">{C.backupIntro}</p>
        <div className="flex flex-wrap gap-2">
          <Btn tone="secondary" onClick={() => setJson(JSON.stringify({ rows: data ?? {} }, null, 2))}>
            {C.export}
          </Btn>
          {canWrite && (
            <Btn
              disabled={imp.isPending || !json}
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
          )}
        </div>
        <div aria-live="polite" className="empty:hidden">
          {parseErr ? (
            <Notice tone="danger">{parseErr}</Notice>
          ) : imp.error ? (
            <Notice tone="danger">{errorText(imp.error)}</Notice>
          ) : imp.isSuccess ? (
            <Notice tone="ok" icon="check-circle">
              {C.imported}
            </Notice>
          ) : null}
        </div>
        <textarea
          aria-label={C.jsonAria}
          className={`${textareaCls} num min-h-40 font-mono text-[13px]`}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </div>
    </details>
  );
}

function MetaRow({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: (p: Patch) => void }) {
  const [sec, setSec] = useState(String(row.typicalSec));
  const n = Number(sec);
  const bad = !Number.isInteger(n) || n < 10 || n > 3600;
  const toggle = (t: Tag) => onSave({ tags: row.tags.includes(t) ? row.tags.filter((x) => x !== t) : [...row.tags, t] });
  const meta = GAME_BY_ID[row.id];
  const name = meta?.name ?? row.id;
  const state = STATES[stateOf(row)];
  const secId = `sec-${row.id}`;
  return (
    <article aria-label={name} className="bg-surface flex flex-col gap-3 rounded-[16px] p-4" data-meta-row={row.id}>
      <div className="flex flex-wrap items-center gap-3">
        {meta && (
          <span role="img" aria-label={C.iconAria(name)} className="shrink-0">
            <GameIcon3D meta={meta} size={44} />
          </span>
        )}
        <div className="flex min-w-[160px] flex-1 flex-col gap-0.5">
          <h2 className="flex flex-wrap items-center gap-2 text-[16px] font-bold">
            {name}
            <StatePill s={state} />
          </h2>
          <p className="text-muted text-[13px]">
            {row.retired ? adminCopy.retired.libraryNote : row.overridden ? C.changedFromDefault : C.usingDefaults}
          </p>
          {row.lab && !row.retired && (
            <p className="text-muted text-[13px]" data-lab-state={row.labOn ? "on" : "off"}>
              {state.meaning}{" "}
              <Link href="/admin/settings" className="hover:text-text font-semibold underline">
                {C.labSwitch}
              </Link>
            </p>
          )}
        </div>
        {row.overridden && canWrite && (
          <Btn
            tone="ghost"
            icon="arrow-counter-clockwise"
            aria-label={C.resetAria(name)}
            disabled={busy}
            onClick={() => {
              if (window.confirm(C.confirmReset(name)))
                onSave({ typicalSec: null, tags: null, rule: null, blurb: null, ...(row.scored ? { typicalScore: null } : {}) });
            }}
          >
            {C.reset}
          </Btn>
        )}
      </div>

      {!row.retired && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <form
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (!bad) onSave({ typicalSec: n });
            }}
          >
            <label htmlFor={secId} className="text-[13px] font-semibold">
              {C.time}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={secId}
                className={`${inputCls} num h-11 w-24`}
                inputMode="numeric"
                value={sec}
                onChange={(e) => setSec(e.target.value)}
                aria-invalid={bad}
                aria-describedby={`${secId}-help`}
                disabled={!canWrite}
              />
              <span className="text-muted text-[13px]">
                {C.timeUnit}
                {!bad && ` (${durationWords(n)})`}
              </span>
              {/* type submit: the shared Btn defaults to a plain button, which would never submit this form */}
              <Btn type="submit" tone="secondary" disabled={!canWrite || busy || bad || n === row.typicalSec}>
                {C.save}
              </Btn>
            </div>
            <span id={`${secId}-help`} className={`text-[12px] ${bad ? "text-danger" : "text-muted"}`}>
              {bad ? C.timeBad : C.timeHelp(durationLabel(row.typicalSec), durationWords(row.default.typicalSec))}
            </span>
          </form>
          <div role="group" aria-labelledby={`tags-${row.id}`} className="flex flex-col gap-1">
            <span id={`tags-${row.id}`} className="text-[13px] font-semibold">
              {C.tags}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => {
                const on = row.tags.includes(t);
                return (
                  <Btn
                    key={t}
                    tone={on ? "primary" : "secondary"}
                    icon={on ? "check" : undefined}
                    disabled={!canWrite || busy}
                    onClick={() => toggle(t)}
                    aria-pressed={on}
                    title={C.tagAria(C.tagLabels[t] ?? t, name, on)}
                  >
                    {C.tagLabels[t] ?? t}
                  </Btn>
                );
              })}
            </div>
            <span className="text-muted text-[12px]">{C.tagsHelp}</span>
          </div>
        </div>
      )}
      {row.scored && !row.retired && <ScoreScale row={row} canWrite={canWrite} busy={busy} onSave={onSave} />}
      {!row.retired && (
        <details className="group border-line border-t" data-copy-editor>
          <summary className="text-muted hover:text-text flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-semibold">
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
              what="The card line"
              onSave={(v) => onSave({ blurb: v })}
            />
          </div>
        </details>
      )}
      {!row.retired && hasLogic(row.id) && <PracticeBoard id={row.id} />}
      <TechDetails>
        <TechLine name={C.techId} value={row.id} />
      </TechDetails>
    </article>
  );
}

/** Owner decision S: a score game's Daily Five typical score (half the bonus at it, the full bonus at twice it). */
function ScoreScale({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: (p: Patch) => void }) {
  const [text, setText] = useState(row.typicalScore != null ? String(row.typicalScore) : "");
  const n = Number(text);
  const bad = text !== "" && (!Number.isInteger(n) || n < 1 || n > TYPICAL_SCORE_MAX);
  const id = `score-${row.id}`;
  return (
    <form
      className="flex flex-col gap-1"
      data-score-scale={row.id}
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad && text !== "") onSave({ typicalScore: n });
      }}
    >
      <label htmlFor={id} className="text-[13px] font-semibold">
        {C.scoreLabel}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          aria-describedby={`${id}-help`}
          className={`${inputCls} num h-11 w-32`}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.trim())}
          aria-invalid={bad}
          disabled={!canWrite}
        />
        <Btn type="submit" tone="secondary" disabled={!canWrite || busy || bad || text === "" || n === row.typicalScore}>
          {C.save}
        </Btn>
        {row.scoreOverridden && (
          <Btn
            tone="ghost"
            disabled={!canWrite || busy}
            onClick={() => {
              setText(row.default.typicalScore != null ? String(row.default.typicalScore) : "");
              onSave({ typicalScore: null });
            }}
          >
            {C.scoreReset}
          </Btn>
        )}
      </div>
      <span id={`${id}-help`} className="text-muted text-[12px]">
        {C.scoreHelp(row.default.typicalScore)}
      </span>
    </form>
  );
}

/** The game's practice round board, read only, loaded when opened (R2-07; the per-game off switch is in Game settings). */
function PracticeBoard({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useAdminQuery<{ puzzle: unknown; solution: unknown; off: boolean; seed: string }>(
    ["games-practice", id],
    open ? `/api/admin/games/practice?game=${encodeURIComponent(id)}` : null,
  );
  return (
    <details data-practice-preview onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="text-muted hover:text-text flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-semibold">
        {C.practice}
        {q.data && <Pill tone={q.data.off ? "warn" : "ok"}>{q.data.off ? C.practiceOff : C.practiceOn}</Pill>}
      </summary>
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-muted text-[13px]">{C.practiceIntro}</p>
        {q.isPending && open && <RowsSkeleton rows={1} height={120} />}
        {q.error && <Notice tone="danger">{errorText(q.error)}</Notice>}
        {q.data && <PracticeBoardPreview game={id} puzzle={q.data.puzzle} solution={q.data.solution} />}
      </div>
    </details>
  );
}

/** One line of game copy: a text field with a live character count, the standard text, Save and Use standard. */
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
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          className={`${inputCls} h-11 min-w-0 flex-1`}
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
