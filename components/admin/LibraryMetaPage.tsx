"use client";

import { useState } from "react";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { GAME_BY_ID } from "@/lib/catalog";
import { TAGS, durationLabel, type GameMetaRow, type Tag } from "@/lib/games-meta";
import { Btn, Notice, PageTitle, RowsSkeleton, inputCls } from "./ui";

type Row = GameMetaRow & { id: string; default: GameMetaRow; overridden: boolean };

/** Admin: Library duration chip and filter tags per game (SPZ-14). Validated here and on the server. */
export function LibraryMetaPage({ canWrite }: { canWrite: boolean }) {
  const q = useAdminQuery<{ rows: Row[]; export: Record<string, unknown> }>(["games-meta"], "/api/admin/games/meta");
  const patch = useAdminAction<{ id: string; typicalSec?: number | null; tags?: Tag[] | null }>("PATCH", "/api/admin/games/meta");
  const imp = useAdminAction<{ rows: Record<string, unknown> }>("PUT", "/api/admin/games/meta");
  const [json, setJson] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle title="Library">
        <span className="text-muted text-[14px]">
          Typical play time (the duration chip) and filter tags per game. Players see changes within 5 minutes.
        </span>
      </PageTitle>
      {(patch.error || imp.error) && <Notice tone="danger">{errorText((patch.error ?? imp.error)!)}</Notice>}
      {q.isPending && <RowsSkeleton />}
      {q.data && (
        <section className="bg-surface flex flex-col rounded-[16px] p-4">
          {q.data.rows.map((r) => (
            <MetaRow key={r.id} row={r} canWrite={canWrite} busy={patch.isPending} onSave={(p) => patch.mutate({ id: r.id, ...p })} />
          ))}
        </section>
      )}
      <section className="bg-surface flex flex-col gap-2.5 rounded-[16px] p-4">
        <h2 className="text-[15px] font-semibold">Export and import</h2>
        <p className="text-muted text-[13px]">Only overrides are exported. Import validates every row before saving any.</p>
        <div className="flex gap-2">
          <Btn tone="secondary" onClick={() => setJson(JSON.stringify({ rows: q.data?.export ?? {} }, null, 2))}>
            Export
          </Btn>
          <Btn
            disabled={!canWrite || imp.isPending || !json}
            onClick={() => {
              try {
                const parsed = JSON.parse(json);
                setParseErr(null);
                imp.mutate(parsed);
              } catch {
                setParseErr("That isn't valid JSON.");
              }
            }}
          >
            Import
          </Btn>
        </div>
        {parseErr && <Notice tone="danger">{parseErr}</Notice>}
        <textarea
          aria-label="Library metadata JSON"
          className={`${inputCls} num min-h-40 font-mono text-[13px]`}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </section>
    </div>
  );
}

function MetaRow({
  row,
  canWrite,
  busy,
  onSave,
}: {
  row: Row;
  canWrite: boolean;
  busy: boolean;
  onSave: (p: { typicalSec?: number | null; tags?: Tag[] | null }) => void;
}) {
  const [sec, setSec] = useState(String(row.typicalSec));
  const n = Number(sec);
  const bad = !Number.isInteger(n) || n < 10 || n > 3600;
  const toggle = (t: Tag) => onSave({ tags: row.tags.includes(t) ? row.tags.filter((x) => x !== t) : [...row.tags, t] });
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] py-2.5 first-of-type:border-0">
      <div className="min-w-[160px] flex-1">
        <p className="text-[14px] font-semibold">{GAME_BY_ID[row.id]?.name ?? row.id}</p>
        <p className="text-muted text-[12px]">
          {row.overridden ? "Changed" : "Default"} · default {durationLabel(row.default.typicalSec)},{" "}
          {row.default.tags.join(", ") || "no tags"}
        </p>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!bad) onSave({ typicalSec: n });
        }}
      >
        <label className="sr-only" htmlFor={`sec-${row.id}`}>
          Typical seconds for {row.id}
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
        <span className="text-muted text-[12px]">s</span>
        <Btn tone="secondary" disabled={!canWrite || busy || bad || n === row.typicalSec}>
          Save
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
        <Btn tone="secondary" disabled={!canWrite || busy} onClick={() => onSave({ typicalSec: null, tags: null })}>
          Reset
        </Btn>
      )}
    </div>
  );
}
