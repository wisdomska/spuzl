"use client";

import { useState, type ReactNode } from "react";
import { errorText } from "@/lib/client/admin";
import type { PackResult } from "@/lib/admin/list-pack";
import { Btn, Field, Notice, textareaCls } from "./ui";

/** Saves a text file in the browser (a JSON pack). */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PackWords {
  tools: string;
  toolsHint: string;
  exportPack: string;
  importPack: string;
  importLabel: string;
  importGo: string;
  fix: string;
}

/**
 * JSON pack tools on the Content page (R2-P5, like the Quads panel): Export saves a pack; Import checks a pasted
 * pack here first, so every problem is listed at once, then hands it to `submit` (which the server checks again).
 * Without `submit` the panel only checks a pack (content kept in code, such as the Draw It words) and `checked`
 * says what it holds.
 */
export function PackPanel<T>({
  id,
  words,
  canWrite,
  exportPack,
  check,
  submit,
  checked,
  children,
}: {
  id: string;
  words: PackWords;
  canWrite: boolean;
  /** builds the file to save: its name, text and a line to show, or a problem line */
  exportPack: () => Promise<{ file: string; text: string; note: string } | { problem: string }>;
  check: (text: string) => PackResult<T>;
  /** saves a checked pack; resolves with the line to show */
  submit?: (text: string) => Promise<string>;
  /** a checked pack's summary when there is nothing to save it to */
  checked?: (items: T[]) => ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "danger"; text: ReactNode; list?: string[] } | null>(null);
  const field = `${id}-pack`;

  const doExport = async () => {
    setNote(null);
    try {
      const r = await exportPack();
      if ("problem" in r) return setNote({ tone: "danger", text: r.problem });
      downloadText(r.file, r.text);
      setNote({ tone: "ok", text: r.note });
    } catch (e) {
      setNote({ tone: "danger", text: errorText(e) });
    }
  };

  const doImport = async () => {
    setNote(null);
    const r = check(text);
    if (!r.ok) return setNote({ tone: "danger", text: words.fix, list: r.errors });
    if (!submit) return setNote({ tone: "ok", text: checked?.(r.items) ?? null });
    setBusy(true);
    try {
      const line = await submit(text);
      setNote({ tone: "ok", text: line });
      setText("");
      setOpen(false);
    } catch (e) {
      setNote({ tone: "danger", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface flex flex-col gap-2 rounded-[12px] p-3" aria-label={words.tools} role="region">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold">{words.tools}</span>
        <Btn size="sm" tone="ghost" icon="download-simple" className="ml-auto" onClick={() => void doExport()}>
          {words.exportPack}
        </Btn>
        {(canWrite || !submit) && (
          <Btn size="sm" tone="ghost" icon="upload-simple" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {words.importPack}
          </Btn>
        )}
      </div>
      <p className="text-muted text-[13px]">{words.toolsHint}</p>
      {children}
      {open && (canWrite || !submit) && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void doImport();
          }}
        >
          <Field label={words.importLabel} htmlFor={field}>
            <textarea
              id={field}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              spellCheck={false}
              className={`${textareaCls} num resize-y text-[13px]`}
            />
          </Field>
          <Btn type="submit" tone="primary" disabled={!text.trim() || busy}>
            {words.importGo}
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
