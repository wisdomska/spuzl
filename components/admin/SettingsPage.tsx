"use client";

import { useId, useState, type ReactNode } from "react";
import { age } from "@/lib/admin/dates";
import { inputSpec, intText, settingValueText } from "@/lib/admin/setting-words";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { SETTING_GROUPS, type SettingDef } from "@/lib/game-settings/schema";
import { adminCopy } from "@/lib/copy/admin";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { Switch } from "@/components/meta/ui";
import { Icon } from "@/components/ui/Icon";
import { Btn, Notice, Pill, RowsSkeleton, inputCls } from "./ui";

type Value = number | boolean | string | string[];
type Row = { key: string; def: SettingDef; value: Value; isDefault: boolean; updatedAt: string | null };
type SaveFn = (v: Value) => void;

const C = adminCopy.settings;

/** Groups whose switches change what every player sees: switching one off asks first. */
const CONFIRM_OFF_GROUPS = new Set<string>(["Features for players", "Party games for older players"]);
const CONFIRM_OFF_KEYS = new Set<string>(["dailyFive.enabled", "streakNudge.enabled", "party.scoreRaces", "features.partyTv"]);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Admin: runtime game settings (lib/game-settings/schema.ts). Range-checked here and on the server. */
export function SettingsPage({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<{ rows: Row[] }>(["game-settings"], "/api/admin/settings");
  const put = useAdminAction<{ key: string; value: Value }>("PUT", "/api/admin/settings");
  const [saved, setSaved] = useState<string | null>(null);
  const groups = new Map<string, Row[]>(SETTING_GROUPS.map((g) => [g.name, []]));
  for (const r of q.data?.rows ?? []) groups.set(r.def.group, [...(groups.get(r.def.group) ?? []), r]);
  const shown = [...groups].filter(([, rows]) => rows.length);
  const about = (name: string) => SETTING_GROUPS.find((g) => g.name === name)?.about;

  const save = (r: Row) => (value: Value) => {
    setSaved(null);
    put.mutate(
      { key: r.key, value },
      { onSuccess: () => setSaved(r.def.kind === "set" ? C.savedSet(r.def.label) : C.saved(r.def.label, settingValueText(r.def, value))) },
    );
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[20px] font-extrabold tracking-[-0.01em]">{C.title}</h1>
        <p className="text-muted max-w-[72ch] text-[14px]">{C.intro}</p>
      </header>

      {!canWrite && q.data && <Notice icon="lock-simple">{C.readOnly}</Notice>}
      <div aria-live="polite" className="empty:hidden">
        {saved && !put.isPending && (
          <Notice tone="ok" icon="check-circle">
            {saved}
          </Notice>
        )}
      </div>
      {put.error && (
        <Notice tone="danger" icon="warning">
          {errorText(put.error)}
        </Notice>
      )}

      {q.isPending ? (
        <div className="bg-surface rounded-[16px]">
          <RowsSkeleton rows={6} height={64} />
        </div>
      ) : q.error ? (
        <Notice
          tone="danger"
          icon="warning"
          action={
            <Btn size="sm" icon="arrow-counter-clockwise" onClick={() => q.refetch()}>
              {C.retry}
            </Btn>
          }
        >
          {C.loadError} {errorText(q.error)}
        </Notice>
      ) : !shown.length ? (
        <Notice icon="info">{C.empty}</Notice>
      ) : (
        <>
          <nav aria-label={C.onThisPage} className="flex flex-wrap gap-2">
            {shown.map(([group]) => (
              <a
                key={group}
                href={`#set-${slug(group)}`}
                className="bg-surface hover:bg-surface-raised flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-semibold focus-visible:shadow-[inset_0_0_0_2px_var(--accent)] focus-visible:outline-none sm:min-h-9"
              >
                {group}
              </a>
            ))}
          </nav>
          {shown.map(([group, rows]) => (
            <section
              key={group}
              id={`set-${slug(group)}`}
              aria-labelledby={`set-${slug(group)}-h`}
              className="bg-surface flex scroll-mt-4 flex-col gap-4 rounded-[16px] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-0.5">
                <h2 id={`set-${slug(group)}-h`} className="font-display text-[17px] font-extrabold">
                  {group}
                </h2>
                {about(group) && <p className="text-muted text-[13px]">{about(group)}</p>}
              </div>
              {rows.map((r) => (
                <SettingRow key={r.key} row={r} canWrite={canWrite} busy={put.isPending} onSave={save(r)} />
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

/** "Default: 3 seconds · Changed 2h ago · Use default" under every setting. */
function DefaultLine({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: SaveFn }) {
  const d = row.def;
  return (
    <p className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <span>{C.defaultIs(settingValueText(d, d.default))}</span>
      {!row.isDefault && (
        <>
          <span aria-hidden>·</span>
          <span title={row.updatedAt ? new Date(row.updatedAt).toLocaleString("en-GB") : undefined}>
            {row.updatedAt ? C.changed(age(row.updatedAt)) : C.changedNoTime}
          </span>
          {canWrite && (
            <>
              <span aria-hidden>·</span>
              <button
                type="button"
                disabled={busy}
                aria-label={C.backToDefaultAria(d.label)}
                onClick={() => onSave(Array.isArray(d.default) ? [...d.default] : (d.default as Value))}
                className="text-accent -my-2 min-h-9 font-semibold hover:underline disabled:opacity-50"
              >
                {C.backToDefault}
              </button>
            </>
          )}
        </>
      )}
    </p>
  );
}

/** Raw key and stored values, folded away. */
function TechDetails({ row }: { row: Row }) {
  const d = row.def;
  const items: [string, ReactNode][] = [
    [C.tech.key, row.key],
    [C.tech.stored, JSON.stringify(row.value)],
    [C.tech.defaultStored, JSON.stringify(d.default)],
  ];
  if (d.kind === "int") items.push([C.tech.range, `${d.min} to ${d.max}${d.unit ? ` ${d.unit}` : ""}`]);
  return (
    <details className="text-muted text-[12px]">
      <summary className="w-fit cursor-pointer py-1 font-semibold">{C.techDetails}</summary>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {items.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>{k}</dt>
            <dd className="num break-all text-[var(--text)]">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** The help line, and the longer text folded under "More". */
function Help({ def, summary = C.more }: { def: SettingDef; summary?: string }) {
  return (
    <>
      <p className="text-muted max-w-[68ch] text-[13px] leading-snug">{def.help}</p>
      {def.more && (
        <details className="text-muted max-w-[68ch] text-[13px] leading-snug">
          <summary className="w-fit cursor-pointer py-0.5 font-semibold text-[var(--text)]">{summary}</summary>
          <p className="mt-1">{def.more}</p>
        </details>
      )}
    </>
  );
}

function SettingRow({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: SaveFn }) {
  const d = row.def;
  const labelId = useId();
  if (d.kind === "set" && d.options.length > 0 && d.options.every((o) => GAME_BY_ID[o.id]))
    return <GameSetRow row={row} canWrite={canWrite} busy={busy} onSave={onSave} />;
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 first-of-type:border-0 first-of-type:pt-0 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={labelId} className="text-[15px] font-semibold">
            {d.label}
          </h3>
          {!row.isDefault && <Pill tone="warn">{C.changedPill}</Pill>}
        </div>
        <Help def={d} />
        <DefaultLine row={row} canWrite={canWrite} busy={busy} onSave={onSave} />
        <TechDetails row={row} />
      </div>
      <div className="shrink-0 md:max-w-[50%]">
        <Control row={row} labelId={labelId} canWrite={canWrite} busy={busy} onSave={onSave} />
      </div>
    </div>
  );
}

function Control({
  row,
  labelId,
  canWrite,
  busy,
  onSave,
}: {
  row: Row;
  labelId: string;
  canWrite: boolean;
  busy: boolean;
  onSave: SaveFn;
}) {
  const d = row.def;
  const disabledWhy = canWrite ? undefined : C.cannotEdit;
  if (d.kind === "bool") {
    const on = row.value === true;
    const confirmOff = CONFIRM_OFF_GROUPS.has(d.group) || CONFIRM_OFF_KEYS.has(row.key);
    return (
      <div className="flex min-h-11 items-center gap-3" title={disabledWhy}>
        <span className={`text-[14px] font-semibold ${on ? "text-accent" : "text-muted"}`} aria-hidden>
          {on ? C.units.on : C.units.off}
        </span>
        <Switch
          checked={on}
          label={d.label}
          disabled={!canWrite || busy}
          onChange={(v) => {
            if (!v && confirmOff && !window.confirm(C.confirmOff(d.label))) return;
            onSave(v);
          }}
        />
      </div>
    );
  }
  if (d.kind === "enum")
    return (
      <select
        aria-labelledby={labelId}
        value={String(row.value)}
        disabled={!canWrite || busy}
        title={disabledWhy}
        onChange={(e) => onSave(e.target.value)}
        className={`${inputCls} h-11 w-44 font-semibold`}
      >
        {d.options.map((o) => (
          <option key={o} value={o}>
            {C.units.choice(o)}
          </option>
        ))}
      </select>
    );
  if (d.kind === "set") {
    const picked = Array.isArray(row.value) ? row.value : [];
    return (
      <ul role="list" aria-labelledby={labelId} className="flex flex-col gap-2">
        {d.options.map((o) => {
          const on = picked.includes(o.id);
          return (
            <li
              key={o.id}
              className="bg-bg flex min-h-11 items-center justify-between gap-3 rounded-[12px] px-3 py-1.5"
              title={disabledWhy}
            >
              <span className="text-[14px]">{o.label}</span>
              <Switch
                checked={on}
                label={o.label}
                disabled={!canWrite || busy}
                onChange={(v) => onSave(v ? [...picked, o.id] : picked.filter((x) => x !== o.id))}
              />
            </li>
          );
        })}
      </ul>
    );
  }
  return <NumberControl row={row} def={d} canWrite={canWrite} busy={busy} onSave={onSave} />;
}

/** A number setting: typed in words-friendly units (seconds, not milliseconds), saved as stored. */
function NumberControl({
  row,
  def: d,
  canWrite,
  busy,
  onSave,
}: {
  row: Row;
  def: Extract<SettingDef, { kind: "int" }>;
  canWrite: boolean;
  busy: boolean;
  onSave: SaveFn;
}) {
  const spec = inputSpec(d);
  const [draft, setDraft] = useState(String(Number(row.value) / spec.scale));
  const id = `set-${row.key.replace(/\W/g, "-")}`;
  const hintId = `${id}-hint`;
  const typed = draft.trim() === "" ? NaN : Number(draft);
  const stored = Math.round(typed * spec.scale);
  const bad = !Number.isFinite(typed) || (spec.scale === 1 && !Number.isInteger(typed)) || stored < d.min || stored > d.max;
  const same = !bad && stored === row.value;
  const message = bad
    ? spec.scale === 1
      ? C.wholeNumber(d.min, d.max)
      : C.between(intText(d, d.min), intText(d, d.max))
    : (d.unit === "s" && stored >= 60) || d.unit?.startsWith("h ")
      ? C.willBe(intText(d, stored))
      : C.allowed(intText(d, d.min), intText(d, d.max));
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad && !same) onSave(stored);
      }}
    >
      <label htmlFor={id} className="text-muted text-[12px] font-semibold">
        {spec.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode={spec.decimals ? "decimal" : "numeric"}
          value={draft}
          disabled={!canWrite}
          title={canWrite ? undefined : C.cannotEdit}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={bad}
          aria-describedby={hintId}
          className={`${inputCls} num h-11 w-28 ${bad ? "shadow-[inset_0_0_0_2px_var(--danger)]" : ""}`}
        />
        <Btn
          type="submit"
          size="lg"
          disabled={!canWrite || busy || bad || same}
          title={!canWrite ? C.cannotEdit : same ? C.noChange : undefined}
        >
          {C.save}
        </Btn>
      </div>
      <p id={hintId} className={`text-[12px] ${bad ? "text-danger font-semibold" : "text-muted"}`}>
        {message}
      </p>
    </form>
  );
}

interface SetWords {
  count: (on: number, total: number) => string;
  on: string;
  off: string;
  toggle: (name: string) => string;
}
const setWords = (key: string): SetWords => (C.setWords as Record<string, SetWords | undefined>)[key] ?? C.setWords.other;

/**
 * A setting that is a set of games (Lab games, practice rounds): a card per game with its tile, world and rule, and
 * a switch, so the owner can see what each game is before switching it on. The longer help folds under "How it works".
 */
export function GameSetRow({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: SaveFn }) {
  const d = row.def;
  if (d.kind !== "set") return null;
  const w = setWords(row.key);
  const picked = Array.isArray(row.value) ? row.value : [];
  const on = d.options.filter((o) => picked.includes(o.id)).length;
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 first-of-type:border-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold">{d.label}</h3>
            {!row.isDefault && <Pill tone="warn">{C.changedPill}</Pill>}
          </div>
          <Help def={d} summary={C.howItWorks} />
        </div>
        <span className="bg-surface-raised flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold" aria-live="polite">
          <span className={on ? "text-accent" : "text-muted"}>{w.count(on, d.options.length)}</span>
        </span>
      </div>
      <ul role="list" aria-label={d.label} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {d.options.map((o) => {
          const g = GAME_BY_ID[o.id];
          const world = WORLD_BY_ID[g.world];
          const isOn = picked.includes(o.id);
          return (
            <li
              key={o.id}
              className="bg-bg flex items-start gap-3 rounded-[14px] p-3 transition-shadow duration-150"
              style={{ boxShadow: isOn ? "inset 0 0 0 2px var(--accent)" : "inset 0 0 0 1px var(--line)" }}
              title={canWrite ? undefined : C.cannotEdit}
            >
              <GameIcon3D meta={g} size={44} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] leading-tight font-bold">{g.name}</span>
                <span className="text-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: world?.color }} />
                    {world?.name}
                  </span>
                  <span aria-hidden>·</span>
                  <span className={`flex items-center gap-1 whitespace-nowrap ${isOn ? "text-accent font-semibold" : ""}`}>
                    {isOn && <Icon name="check" size={12} />}
                    {isOn ? w.on : w.off}
                  </span>
                </span>
                <span className="text-muted mt-0.5 text-[13px] leading-snug">{g.rule}</span>
              </div>
              <Switch
                checked={isOn}
                label={w.toggle(g.name)}
                disabled={!canWrite || busy}
                onChange={(v) => onSave(v ? [...picked, o.id] : picked.filter((x) => x !== o.id))}
              />
            </li>
          );
        })}
      </ul>
      <DefaultLine row={row} canWrite={canWrite} busy={busy} onSave={onSave} />
      <TechDetails row={row} />
    </div>
  );
}
