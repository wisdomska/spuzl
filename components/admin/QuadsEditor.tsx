"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client/api";
import { errorText, useAdminAction } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { createRng } from "@/lib/rng";
import { parsePack, repeatedWords, setDifficulty, toDraft, type QuadsPayload } from "@/lib/admin/quads-pack";
import { Btn, Field, Notice, inputCls, textareaCls } from "./ui";
import { Select } from "@/components/ui/Select";

const Q = adminCopy.content.quads;
const BG = ["var(--quad-0)", "var(--quad-1)", "var(--quad-2)", "var(--quad-3)"] as const;
const SHAPE = ["circle", "triangle", "square", "diamond"] as const;

/** The editor's working copy (lib/admin/quads-pack.ts, shared with the server export). */
export { toDraft };

/**
 * Quads puzzle editor (admin Content, R2-14): four groups, each with a difficulty (Easy to Tricky, shown with its
 * board colour and shape), a name and four words. It edits the same payload as the JSON box beside it; the JSON
 * stays the source of truth and the schema check under it is the gate (lib/admin/content-schemas.ts).
 */
export function QuadsEditor({ value, readOnly, onChange }: { value: unknown; readOnly: boolean; onChange: (p: QuadsPayload) => void }) {
  const draft = toDraft(value);
  const twice = repeatedWords(draft);
  const set = (gi: number, patch: Partial<QuadsPayload["groups"][number]>) =>
    onChange({ groups: draft.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  return (
    <fieldset className="flex flex-col gap-2" disabled={readOnly}>
      <legend className="text-[13px] font-semibold">{Q.editor}</legend>
      <p className="text-muted text-[13px]">{Q.editorHint}</p>
      {draft.groups.map((g, gi) => (
        <div key={gi} data-quads-group={gi} className="bg-bg flex flex-col gap-2 rounded-[12px] p-2.5 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-8 flex-none items-center justify-center rounded-[8px]"
              style={{ backgroundColor: BG[gi], color: "var(--quad-ink)" }}
            >
              <Icon name={SHAPE[gi]} size={14} />
            </span>
            <Select
              aria-label={Q.difficulty(gi + 1)}
              value={String(gi)}
              onValueChange={(v) => onChange({ groups: setDifficulty(draft.groups, gi, Number(v)) })}
              options={Q.levels.map((l, i) => ({ value: String(i), label: l }))}
              className="w-28"
            />
            <input
              aria-label={Q.name(gi + 1)}
              value={g.label}
              maxLength={40}
              onChange={(e) => set(gi, { label: e.target.value })}
              className={`${inputCls} min-w-0 flex-1`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {g.words.map((w, wi) => {
              const dup = twice.has(w.trim().toUpperCase());
              return (
                <input
                  key={wi}
                  aria-label={Q.word(gi + 1, wi + 1)}
                  aria-invalid={dup || undefined}
                  title={dup ? Q.repeated(w.trim().toUpperCase()) : undefined}
                  value={w}
                  maxLength={15}
                  onChange={(e) => set(gi, { words: g.words.map((x, k) => (k === wi ? e.target.value.toUpperCase() : x)) })}
                  className={`${inputCls} num min-w-0 uppercase ${dup ? "shadow-[inset_0_0_0_2px_var(--danger)]" : ""}`}
                />
              );
            })}
          </div>
        </div>
      ))}
      {twice.size > 0 && (
        <p className="text-danger text-[13px] font-medium" role="status">
          {[...twice].map(Q.repeated).join(" ")}
        </p>
      )}
    </fieldset>
  );
}

/** What players see: the solved bars by difficulty, then the 16 words shuffled as on a board. */
export function QuadsPreview({ value }: { value: unknown }) {
  const draft = toDraft(value);
  const words = createRng(`preview:${JSON.stringify(draft)}`).shuffle(draft.groups.flatMap((g) => g.words.filter(Boolean)));
  return (
    <section aria-label={Q.preview} className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-semibold">{Q.preview}</h3>
      <p className="text-muted text-[12px]">{Q.previewHint}</p>
      <div className="flex flex-col gap-1.5 rounded-[16px] p-2" style={{ background: "var(--board-bg)" }}>
        {draft.groups.map((g, i) => (
          <div
            key={i}
            data-quad={i}
            className="flex min-h-11 flex-col items-center justify-center rounded-[10px] px-2 py-1 text-center"
            style={{ backgroundColor: BG[i], color: "var(--quad-ink)" }}
          >
            <span className="flex items-center gap-1.5 text-[12px] font-extrabold">
              <Icon name={SHAPE[i]} size={10} />
              <span className="uppercase">{Q.levels[i]}</span>
              <span className="truncate">{g.label || "…"}</span>
            </span>
            <span className="text-[12px] font-medium">{g.words.filter(Boolean).join(" · ") || "…"}</span>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {words.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="bg-surface-raised flex h-11 min-w-0 items-center justify-center rounded-[10px] px-1 text-[11px] font-bold"
            >
              <span className="truncate">{w}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Quads pack tools on the Content page: export the listed Quads items (the current status filter) as a JSON pack
 * (built by GET /api/admin/content/export, which audits it),
 * or import a pack as drafts (POST /api/admin/content/import, all or nothing). The pack format and its
 * round trip live in lib/admin/quads-pack.ts.
 */
export function QuadsPackPanel({ status, canWrite }: { status: string; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "danger"; text: string; list?: string[] } | null>(null);
  const imp = useAdminAction<{ game: "quads"; text: string }, { created: number }>("POST", "/api/admin/content/import");

  const exportPack = async () => {
    setNote(null);
    try {
      // R4-16: built on the server, which writes the audit row (content.export).
      const r = await api<{ filename: string; json: string; count: number }>(
        `/api/admin/content/export?game=quads${status ? `&status=${status}` : ""}`,
      );
      if (!r.count) return setNote({ tone: "danger", text: Q.nothing });
      download(r.filename, r.json);
      setNote({ tone: "ok", text: Q.exported(r.count) });
    } catch (e) {
      setNote({ tone: "danger", text: errorText(e) });
    }
  };

  return (
    <div className="bg-surface flex flex-col gap-2 rounded-[12px] p-3" aria-label={Q.tools} role="region">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold">{Q.tools}</span>
        <Btn size="sm" tone="ghost" icon="download-simple" className="ml-auto" onClick={() => void exportPack()}>
          {Q.exportPack}
        </Btn>
        {canWrite && (
          <Btn size="sm" tone="ghost" icon="upload-simple" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {Q.importPack}
          </Btn>
        )}
      </div>
      <p className="text-muted text-[13px]">{Q.toolsHint}</p>
      {open && canWrite && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setNote(null);
            // Checked here first so every problem is listed at once; the server checks it again before saving.
            const check = parsePack(text);
            if (!check.ok) return setNote({ tone: "danger", text: Q.fix, list: check.errors });
            imp.mutate(
              { game: "quads", text },
              {
                onSuccess: (r) => (setNote({ tone: "ok", text: Q.imported(r.created) }), setText(""), setOpen(false)),
                onError: (err) => setNote({ tone: "danger", text: errorText(err) }),
              },
            );
          }}
        >
          <Field label={Q.importLabel} htmlFor="quads-pack">
            <textarea
              id="quads-pack"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              spellCheck={false}
              className={`${textareaCls} num resize-y text-[13px]`}
            />
          </Field>
          <Btn type="submit" tone="primary" disabled={!text.trim() || imp.isPending}>
            {Q.importGo}
          </Btn>
        </form>
      )}
      <div aria-live="polite" className="empty:hidden">
        {note && (
          <Notice tone={note.tone} icon={note.tone === "ok" ? "check-circle" : "warning"}>
            {note.text}
            {note.list && (
              <ul className="mt-1 text-[13px]">
                {note.list.slice(0, 12).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}
      </div>
    </div>
  );
}
