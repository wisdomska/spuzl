"use client";

import { useMemo, useState } from "react";
import { adminCopy } from "@/lib/copy/admin";
import { FAMILY_DRAW_WORDS } from "@/lib/party-adult/family";
import { drawPackDiff, drawPackToJson, parseDrawPack } from "@/lib/admin/draw-pack";
import { PackPanel } from "./PackPanel";
import { inputCls } from "./ui";

const W = adminCopy.content.drawit;

/**
 * Content page, Family Draw words tab (R2-P5): the 16+ Draw It word list as players get it (each word with the
 * other names a guess used to accept), a search, and the JSON tools: export the list, or check a pasted pack (every
 * problem listed; a pack that passes says which words it adds and drops). The list ships in code, so nothing is
 * saved here; read-only for every admin role.
 */
export function DrawWordsPanel() {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? FAMILY_DRAW_WORDS.filter((w) => [w.word, ...(w.alt ?? [])].some((x) => x.includes(k))) : FAMILY_DRAW_WORDS;
  }, [q]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-[14px]">{W.intro(FAMILY_DRAW_WORDS.length)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={W.search}
          placeholder={W.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputCls} w-64`}
        />
        <span className="num text-muted text-[13px]" aria-live="polite">
          {W.count(shown.length, FAMILY_DRAW_WORDS.length)}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4" aria-label={W.title}>
        {shown.map((w) => (
          <li key={w.word} className="bg-surface flex min-h-11 flex-col justify-center rounded-[10px] px-2.5 py-1.5">
            <span className="text-[14px] font-semibold capitalize">{w.word}</span>
            {w.alt?.length ? <span className="text-muted text-[12px]">{W.also(w.alt.join(", "))}</span> : null}
          </li>
        ))}
      </ul>
      <PackPanel
        id="drawit"
        words={W}
        canWrite={false}
        check={parseDrawPack}
        checked={(items) => {
          const d = drawPackDiff(FAMILY_DRAW_WORDS, items);
          return W.checked(items.length, d.added, d.dropped);
        }}
        exportPack={async () => ({
          file: "spuzl-family-draw-words.json",
          text: drawPackToJson(FAMILY_DRAW_WORDS),
          note: W.exported(FAMILY_DRAW_WORDS.length),
        })}
      />
    </div>
  );
}
