"use client";

import { useState } from "react";
import { age } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import type { SettingDef } from "@/lib/game-settings/schema";
import { Btn, Field, Notice, PageTitle, RowsSkeleton, inputCls } from "./ui";

type Row = { key: string; def: SettingDef; value: number | boolean; isDefault: boolean; updatedAt: string | null };

/** Admin: runtime game settings (lib/game-settings/schema.ts). Range-checked here and on the server. */
export function SettingsPage({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<{ rows: Row[] }>(["game-settings"], "/api/admin/settings");
  const put = useAdminAction<{ key: string; value: number | boolean }>("PUT", "/api/admin/settings");
  const groups = new Map<string, Row[]>();
  for (const r of q.data?.rows ?? []) groups.set(r.def.group, [...(groups.get(r.def.group) ?? []), r]);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title="Game settings">
        <span className="text-muted text-[14px]">Tunables the game reads at runtime. Changes reach players within a minute.</span>
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

function SettingRow({
  row,
  canWrite,
  busy,
  onSave,
}: {
  row: Row;
  canWrite: boolean;
  busy: boolean;
  onSave: (v: number | boolean) => void;
}) {
  const d = row.def;
  const [draft, setDraft] = useState(String(row.value));
  const id = `set-${row.key.replace(/\W/g, "-")}`;
  const n = Number(draft);
  const bad = d.kind === "int" && (!Number.isInteger(n) || n < d.min || n > d.max);
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-3 first-of-type:border-0 first-of-type:pt-0">
      <div className="min-w-[240px] flex-1">
        <p className="text-[14px] font-semibold">
          {d.label} <span className="num text-muted text-[12px] font-normal">{row.key}</span>
        </p>
        <p className="text-muted text-[13px]">{d.help}</p>
        <p className="text-muted text-[12px]">
          {row.isDefault ? "Default" : `Changed ${row.updatedAt ? age(row.updatedAt) : ""}`}
          {d.kind === "int"
            ? ` · default ${d.default}, range ${d.min} to ${d.max}${d.unit ? ` ${d.unit}` : ""}`
            : ` · default ${d.default ? "on" : "off"}`}
        </p>
      </div>
      {d.kind === "bool" ? (
        <Btn tone={row.value ? "primary" : "secondary"} disabled={!canWrite || busy} onClick={() => onSave(!row.value)}>
          {row.value ? "On" : "Off"}
        </Btn>
      ) : (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!bad) onSave(n);
          }}
        >
          <Field label={d.unit ?? "Value"} htmlFor={id}>
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
            Save
          </Btn>
        </form>
      )}
      {bad && (
        <p className="text-danger w-full text-[13px]">Must be a whole number from {d.kind === "int" ? `${d.min} to ${d.max}` : ""}.</p>
      )}
    </div>
  );
}
