"use client";

import { useState } from "react";
import { age } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import type { SettingDef } from "@/lib/game-settings/schema";
import { adminCopy } from "@/lib/copy/admin";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { Switch } from "@/components/meta/ui";
import { Btn, Field, Notice, PageTitle, RowsSkeleton, inputCls } from "./ui";

type Value = number | boolean | string | string[];
type Row = { key: string; def: SettingDef; value: Value; isDefault: boolean; updatedAt: string | null };

const C = adminCopy.settings;
const { common } = adminCopy;

/** Admin: runtime game settings (lib/game-settings/schema.ts). Range-checked here and on the server. */
export function SettingsPage({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<{ rows: Row[] }>(["game-settings"], "/api/admin/settings");
  const put = useAdminAction<{ key: string; value: Value }>("PUT", "/api/admin/settings");
  const groups = new Map<string, Row[]>();
  for (const r of q.data?.rows ?? []) groups.set(r.def.group, [...(groups.get(r.def.group) ?? []), r]);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title={C.title}>
        <span className="text-muted text-[14px]">{C.intro}</span>
      </PageTitle>
      {put.error && <Notice tone="danger">{errorText(put.error)}</Notice>}
      {q.isPending && <RowsSkeleton />}
      {[...groups].map(([group, rows]) => (
        <section key={group} className="bg-surface flex flex-col gap-3 rounded-[16px] p-4">
          <h2 className="text-[15px] font-semibold">{group}</h2>
          {rows.map((r) => (
            <SettingRow
              key={r.key}
              row={r}
              canWrite={canWrite}
              busy={put.isPending}
              onSave={(value) => put.mutate({ key: r.key, value })}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function SettingRow({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: (v: Value) => void }) {
  const d = row.def;
  const [draft, setDraft] = useState(String(row.value));
  const id = `set-${row.key.replace(/\W/g, "-")}`;
  const n = Number(draft);
  const bad = d.kind === "int" && (!Number.isInteger(n) || n < d.min || n > d.max);
  if (d.kind === "set" && d.options.length > 0 && d.options.every((o) => GAME_BY_ID[o.id]))
    return <GameSetRow row={row} canWrite={canWrite} busy={busy} onSave={onSave} />;
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-3 first-of-type:border-0 first-of-type:pt-0">
      <div className="min-w-[240px] flex-1">
        <p className="text-[14px] font-semibold">
          {d.label} <span className="num text-muted text-[12px] font-normal">{row.key}</span>
        </p>
        <p className="text-muted text-[13px]">{d.help}</p>
        <p className="text-muted text-[12px]">
          {row.isDefault ? C.isDefault : C.changed(row.updatedAt ? age(row.updatedAt) : "")}
          {d.kind === "int"
            ? C.intRange(d.default, d.min, d.max, d.unit)
            : d.kind === "set"
              ? C.setDefault(d.options.filter((o) => d.default.includes(o.id)).map((o) => o.label))
              : d.kind === "enum"
                ? C.enumDefault(d.default, d.options)
                : C.boolDefault(d.default)}
        </p>
      </div>
      {d.kind === "set" ? (
        <div role="group" aria-label={d.label} className="flex flex-wrap gap-2">
          {d.options.map((o) => {
            const picked = Array.isArray(row.value) ? row.value : [];
            const on = picked.includes(o.id);
            return (
              <Btn
                key={o.id}
                tone={on ? "primary" : "secondary"}
                aria-pressed={on}
                disabled={!canWrite || busy}
                onClick={() => onSave(on ? picked.filter((x) => x !== o.id) : [...picked, o.id])}
              >
                {o.label}
              </Btn>
            );
          })}
        </div>
      ) : d.kind === "bool" ? (
        <Btn tone={row.value ? "primary" : "secondary"} disabled={!canWrite || busy} onClick={() => onSave(!row.value)}>
          {row.value ? common.on : common.off}
        </Btn>
      ) : d.kind === "enum" ? (
        <Field label={C.value} htmlFor={id}>
          <select
            id={id}
            value={String(row.value)}
            disabled={!canWrite || busy}
            onChange={(e) => onSave(e.target.value)}
            className={`${inputCls} w-36 font-semibold`}
          >
            {d.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!bad) onSave(n);
          }}
        >
          <Field label={d.unit ?? C.value} htmlFor={id}>
            <input
              id={id}
              inputMode="numeric"
              value={draft}
              disabled={!canWrite}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={bad}
              className={`${inputCls} num w-28`}
            />
          </Field>
          <Btn type="submit" disabled={!canWrite || busy || bad || n === row.value}>
            {C.save}
          </Btn>
        </form>
      )}
      {bad && <p className="text-danger w-full text-[13px]">{d.kind === "int" ? C.wholeNumber(d.min, d.max) : ""}</p>}
    </div>
  );
}

/** The first sentence of a help text, and the rest (folded under "How it works"). */
function splitHelp(help: string): [string, string] {
  const i = help.indexOf(". ");
  return i < 0 ? [help, ""] : [help.slice(0, i + 1), help.slice(i + 2)];
}

/**
 * A setting that is a set of games (Lab games): a card per game with its tile, world and rule, and a switch, so the
 * owner can see what each game is before switching it on. The long help folds under "How it works".
 */
export function GameSetRow({ row, canWrite, busy, onSave }: { row: Row; canWrite: boolean; busy: boolean; onSave: (v: Value) => void }) {
  const d = row.def;
  if (d.kind !== "set") return null;
  const picked = Array.isArray(row.value) ? row.value : [];
  const [lead, more] = splitHelp(d.help);
  const on = d.options.filter((o) => picked.includes(o.id)).length;
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-3 first-of-type:border-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[14px] font-semibold">
            {d.label} <span className="num text-muted text-[12px] font-normal">{row.key}</span>
          </p>
          <p className="text-muted max-w-[72ch] text-[13px]">{lead}</p>
        </div>
        <span className="bg-surface-raised flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold" aria-live="polite">
          <span className={on ? "text-accent" : "text-muted"}>{C.onCount(on, d.options.length)}</span>
        </span>
      </div>
      {more && (
        <details className="text-muted max-w-[72ch] text-[13px]">
          <summary className="w-fit cursor-pointer font-semibold text-[var(--text)]">{C.howItWorks}</summary>
          <p className="mt-1.5">{more}</p>
        </details>
      )}
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
            >
              <GameIcon3D meta={g} size={44} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] leading-tight font-bold">{g.name}</span>
                <span className="text-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-medium">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: world.color }} />
                    {world.name}
                  </span>
                  <span aria-hidden>·</span>
                  <span className={`whitespace-nowrap ${isOn ? "text-accent font-semibold" : ""}`}>{isOn ? C.gameOn : C.gameOff}</span>
                </span>
                <span className="text-muted mt-0.5 text-[13px] leading-snug">{g.rule}</span>
              </div>
              <Switch
                checked={isOn}
                label={C.toggleGame(g.name)}
                disabled={!canWrite || busy}
                onChange={(v) => onSave(v ? [...picked, o.id] : picked.filter((x) => x !== o.id))}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-muted text-[12px]">
        {row.isDefault ? C.isDefault : C.changed(row.updatedAt ? age(row.updatedAt) : "")}
        {C.setDefault(d.options.filter((o) => d.default.includes(o.id)).map((o) => o.label))}
      </p>
    </div>
  );
}
