"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { GAME_BY_ID, GAME_STATES, type GameState } from "@/lib/catalog";
import { STATE_FILTERS, byState, rowState, stateCounts, type RowState, type StateFilter } from "@/lib/game-state";
import { COPY_MAX, TAGS, TYPICAL_SCORE_MAX, durationLabel, validateCopyLine, type GameMetaRow, type Tag } from "@/lib/games-meta";
import { durationWords } from "@/lib/admin/content-words";
import { adminCopy } from "@/lib/copy/admin";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { Icon } from "@/components/ui/Icon";
import { hasLogic } from "@/games/logic-ids";
import { PracticeBoardPreview } from "./PuzzlePreview";
import { Paged } from "./Pagination";
import { PageHead, StateGuide, StatePill, TechDetails, TechLine, type StateWords } from "./content-ui";
import { Btn, Confirm, Empty, Notice, Pill, RowsSkeleton, inputCls, textareaCls } from "./ui";

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
  /** On, In testing or Off (Games page state); absent on retired rows */
  state?: GameState;
  /** a race game: "Can be played in Duels and Parties" applies */
  versusEligible?: boolean;
  versus?: boolean;
  /** a game with a practice round (it has logic) */
  hasPractice?: boolean;
  practiceOff?: boolean;
};
/** One switch on the Games page (PATCH /api/admin/games/state, owner only). */
type Switch = { state?: GameState; versus?: boolean; practice?: boolean };
type SwitchResult = { id: string; state: GameState; dailyFive?: { days: unknown[] } };
type Patch = {
  typicalSec?: number | null;
  tags?: Tag[] | null;
  rule?: string | null;
  blurb?: string | null;
  typicalScore?: number | null;
};
/** Each state's pill: a word, a meaning and an icon (never colour alone). */
const STATES: Record<RowState, StateWords> = {
  on: { ...C.states.on, tone: "ok", icon: "check-circle" },
  testing: { ...C.states.testing, tone: "warn", icon: "flask" },
  off: { ...C.states.off, tone: "danger", icon: "eye-slash" },
  retired: { ...C.states.retired, tone: "neutral", icon: "prohibit" },
};
const nameOf = (id: string) => GAME_BY_ID[id]?.name ?? id;

/**
 * Admin Games page (was Library; SPZ-14, R2-ADMIN): every per-game edit on that game's row. Who can play it (On, In
 * testing, Off: owner only, with a confirm before players lose it), whether it can be played in Duels and Parties and
 * whether it has a practice round (owner only), then the play time on its card, its filter tags, its one-line rule and
 * card line and (score games) its Daily Five typical score (content editors too). Validated here and on the server;
 * every change is audited (game_meta.update, game_state.update).
 */
export function LibraryMetaPage({ canWrite, canSwitch = false }: { canWrite: boolean; canSwitch?: boolean }) {
  const q = useAdminQuery<{ rows: Row[]; export: Record<string, unknown> }>(["games-meta"], "/api/admin/games/meta");
  const patch = useAdminAction<{ id: string } & Patch>("PATCH", "/api/admin/games/meta");
  const flip = useAdminAction<{ id: string } & Switch, SwitchResult>("PATCH", "/api/admin/games/state");
  const [find, setFind] = useState("");
  const [show, setShow] = useState<StateFilter>("all");
  const [saved, setSaved] = useState<string | null>(null);

  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const counts = useMemo(() => stateCounts(rows), [rows]);
  const shown = useMemo(() => {
    const k = find.trim().toLowerCase();
    return byState(rows, show).filter((r) => !k || nameOf(r.id).toLowerCase().includes(k));
  }, [rows, find, show]);

  const save = (id: string, p: Patch) => {
    setSaved(null);
    patch.mutate({ id, ...p }, { onSuccess: () => setSaved(C.savedNote(nameOf(id))) });
  };
  const change = (id: string, s: Switch) => {
    setSaved(null);
    flip.mutate(
      { id, ...s },
      {
        onSuccess: (res) => {
          const moved = res?.dailyFive?.days.length ?? 0;
          setSaved(
            s.state
              ? `${C.stateSaved(nameOf(id), STATES[s.state].label)}${moved ? ` ${C.dailyFiveMoved(moved)}` : ""}`
              : C.savedNote(nameOf(id)),
          );
        },
      },
    );
  };
  const error = patch.error ?? flip.error;

  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead title={C.title} purpose={C.intro} />
      {!canWrite ? <Notice icon="info">{C.readOnly}</Notice> : !canSwitch ? <Notice icon="info">{C.switchReadOnly}</Notice> : null}
      <StateGuide states={Object.values(STATES)} />
      <div aria-live="polite" className="empty:hidden">
        {error ? (
          <Notice tone="danger" icon="warning">
            {errorText(error)}
          </Notice>
        ) : saved ? (
          <Notice tone="ok" icon="check-circle">
            {saved}
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
        <StateTabs value={show} onChange={setShow} counts={counts} />
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
        // 25 games a page; a new search or filter starts again from page 1 (the key).
        <Paged key={`${show}:${find}`} items={shown} size={25} label={C.pageLabel}>
          {(page) => (
            <ul className="flex flex-col gap-3">
              {page.map((r) => (
                <li key={r.id}>
                  <MetaRow
                    row={r}
                    canWrite={canWrite && !r.retired}
                    canSwitch={canSwitch && !r.retired}
                    busy={patch.isPending || flip.isPending}
                    onSave={(p) => save(r.id, p)}
                    onSwitch={(s) => change(r.id, s)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Paged>
      )}
      <Backup canWrite={canWrite} data={q.data?.export} />
    </div>
  );
}

/** The state filter (All, On, In testing, Off, Retired), each with how many games it shows, zero included. */
function StateTabs({
  value,
  onChange,
  counts,
}: {
  value: StateFilter;
  onChange: (v: StateFilter) => void;
  counts: Record<StateFilter, number>;
}) {
  return (
    <div role="tablist" aria-label={C.show} className="bg-surface flex flex-wrap gap-1 rounded-[10px] p-[3px]" data-state-filter>
      {STATE_FILTERS.map((id) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          data-filter={id}
          className={`flex h-11 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold ${value === id ? "bg-surface-raised text-text" : "text-muted hover:text-text"}`}
        >
          {C.showTabs[id]}
          <span className="num text-muted text-[12px]">{counts[id]}</span>
        </button>
      ))}
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

function MetaRow({
  row,
  canWrite,
  canSwitch,
  busy,
  onSave,
  onSwitch,
}: {
  row: Row;
  canWrite: boolean;
  canSwitch: boolean;
  busy: boolean;
  onSave: (p: Patch) => void;
  onSwitch: (s: Switch) => void;
}) {
  const [sec, setSec] = useState(String(row.typicalSec));
  const n = Number(sec);
  const bad = !Number.isInteger(n) || n < 10 || n > 3600;
  const toggle = (t: Tag) => onSave({ tags: row.tags.includes(t) ? row.tags.filter((x) => x !== t) : [...row.tags, t] });
  const meta = GAME_BY_ID[row.id];
  const name = meta?.name ?? row.id;
  const st = rowState(row);
  const state = STATES[st];
  const secId = `sec-${row.id}`;
  return (
    // One compact row per game (tile, name, state, play time, tags); it opens to edit, so 62 games stay scannable.
    <details aria-label={name} className="group/game bg-surface rounded-[16px]" data-meta-row={row.id} data-state={st}>
      <summary className="flex min-h-[72px] cursor-pointer list-none flex-wrap items-center gap-3 rounded-[16px] p-3 md:px-4 [&::-webkit-details-marker]:hidden">
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
          {st !== "on" && st !== "retired" && <p className="text-muted text-[13px]">{state.meaning}</p>}
        </div>
        {!row.retired && (
          <span className="text-muted flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
            <span className="bg-surface-raised flex h-7 items-center gap-1 rounded-[8px] px-2">
              <Icon name="timer" size={14} />
              {durationLabel(row.typicalSec)}
            </span>
            {row.tags.map((t) => (
              <span key={t} className="bg-surface-raised flex h-7 items-center rounded-[8px] px-2">
                {C.tagLabels[t] ?? t}
              </span>
            ))}
          </span>
        )}
        <span className="text-muted flex h-9 items-center gap-1 rounded-[10px] px-2 text-[13px] font-semibold">
          <span className="group-open/game:hidden">{C.edit}</span>
          <span className="hidden group-open/game:inline">{C.close}</span>
          <Icon name="caret-down" size={16} className="transition-transform duration-150 group-open/game:rotate-180" />
        </span>
      </summary>
      <div className="border-line flex flex-col gap-3 border-t p-4">
        {!row.retired && row.state && <ForPlayers row={row} name={name} canSwitch={canSwitch} busy={busy} onSwitch={onSwitch} />}
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
          <details className="group/fold border-line border-t" data-copy-editor>
            <summary className="hover:text-text flex min-h-11 cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
              <Icon name="caret-right" size={14} className="text-muted transition-transform duration-150 group-open/fold:rotate-90" />
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
      </div>
    </details>
  );
}

/**
 * Who can play the game (On, In testing, Off: a radio group with what each means, and a confirm saying what players
 * lose before In testing or Off), then its Duels and Parties and practice round switches. Owner only (the server
 * checks too).
 */
function ForPlayers({
  row,
  name,
  canSwitch,
  busy,
  onSwitch,
}: {
  row: Row;
  name: string;
  canSwitch: boolean;
  busy: boolean;
  onSwitch: (s: Switch) => void;
}) {
  const [ask, setAsk] = useState<GameState | null>(null);
  const current = row.state ?? "on";
  const pick = (s: GameState) => {
    if (s === current) return;
    // Players lose the game: say what that means first. Back On needs no confirm.
    if (s === "on") onSwitch({ state: s });
    else setAsk(s);
  };
  const groupId = `state-${row.id}`;
  return (
    <section aria-labelledby={groupId} className="flex flex-col gap-3" data-for-players>
      <div className="flex flex-col gap-1.5">
        <h3 id={groupId} className="text-[13px] font-semibold">
          {C.stateTitle}
        </h3>
        <div role="radiogroup" aria-label={C.stateAria(name)} className="bg-surface-raised flex w-fit flex-wrap gap-1 rounded-[12px] p-1">
          {GAME_STATES.map((s) => {
            const on = s === current;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!canSwitch || busy}
                title={!canSwitch ? C.switchReadOnly : STATES[s].meaning}
                data-state-option={s}
                onClick={() => pick(s)}
                className={`flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold disabled:cursor-not-allowed ${
                  on
                    ? s === "on"
                      ? "bg-accent text-on-accent"
                      : "bg-surface text-text shadow-[inset_0_0_0_2px_var(--line)]"
                    : "text-muted hover:text-text"
                } ${!on && (!canSwitch || busy) ? "opacity-50" : ""}`}
              >
                <Icon name={STATES[s].icon ?? "circle"} size={16} />
                {STATES[s].label}
              </button>
            );
          })}
        </div>
        <p className="text-muted text-[12px]">{STATES[current].meaning}</p>
        {current === "testing" && (
          <p className="flex flex-wrap items-center gap-2 text-[12px]">
            <Link
              href={`/play/${row.id}?mode=free`}
              target="_blank"
              rel="noopener"
              aria-label={C.tryItAria(name)}
              className="bg-surface-raised hover:text-text inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold"
              data-try-it
            >
              <Icon name="play" size={14} />
              {C.tryIt}
            </Link>
            <span className="text-muted">{C.tryItHelp}</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {row.versusEligible && (
          <OnOff
            id={`versus-${row.id}`}
            label={C.versus}
            help={C.versusHelp}
            aria={C.versusAria(name)}
            on={row.versus !== false}
            disabled={!canSwitch || busy}
            onChange={(v) => onSwitch({ versus: v })}
          />
        )}
        {row.hasPractice && (
          <OnOff
            id={`practice-${row.id}`}
            label={C.practiceSwitch}
            help={C.practiceSwitchHelp}
            aria={C.practiceSwitchAria(name)}
            on={!row.practiceOff}
            disabled={!canSwitch || busy}
            onChange={(v) => onSwitch({ practice: v })}
          />
        )}
      </div>
      <Confirm
        open={ask !== null}
        title={ask ? C.confirmTitle(name, STATES[ask].label) : ""}
        body={ask ? C.confirmLose(name, ask === "off") : ""}
        confirmLabel={ask === "off" ? C.confirmOff : C.confirmTesting}
        danger={ask === "off"}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          if (ask) onSwitch({ state: ask });
          setAsk(null);
        }}
      />
    </section>
  );
}

/** One on/off switch with its label, a line of help and the current value in words. */
function OnOff({
  id,
  label,
  help,
  aria,
  on,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  aria: string;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="bg-surface-raised flex items-start gap-3 rounded-[12px] p-3" data-switch={id}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-[13px] font-semibold">
          {label}
        </span>
        <span id={`${id}-help`} className="text-muted text-[12px]">
          {help}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={aria}
        aria-describedby={`${id}-help`}
        disabled={disabled}
        title={disabled ? C.switchReadOnly : undefined}
        onClick={() => onChange(!on)}
        className={`flex h-11 min-w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
          on ? "bg-accent text-on-accent" : "bg-surface text-muted shadow-[inset_0_0_0_2px_var(--line)]"
        }`}
      >
        <Icon name={on ? "check" : "x"} size={14} />
        {on ? C.switchOn : C.switchOff}
      </button>
    </div>
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

/** The game's practice round board, read only, loaded when opened (R2-07; its on/off switch is in "Who can play it"). */
function PracticeBoard({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const q = useAdminQuery<{ puzzle: unknown; solution: unknown; off: boolean; seed: string }>(
    ["games-practice", id],
    open ? `/api/admin/games/practice?game=${encodeURIComponent(id)}` : null,
  );
  return (
    <details className="group/fold" data-practice-preview onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="hover:text-text flex min-h-11 cursor-pointer list-none items-center gap-2 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
        <Icon name="caret-right" size={14} className="text-muted transition-transform duration-150 group-open/fold:rotate-90" />
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
