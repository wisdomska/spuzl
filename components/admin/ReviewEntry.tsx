"use client";

import type { ReactNode } from "react";
import { Flag } from "@/games/flagged/Flag";
import type { FlagSpec } from "@/games/flagged/content";
import { adminCopy } from "@/lib/copy/admin";
import { EMOJI_COPY } from "@/lib/copy/emojihits";
import { QuadsPreview } from "./QuadsEditor";
import { TruthsPreview } from "./TruthsEditor";

const R = adminCopy.content.review;
type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(str) : []);

/** Letter tiles, as the word games show letters. */
function Tiles({ word, label }: { word: string; label?: string }) {
  return (
    <span className="flex flex-wrap gap-1" aria-label={label ?? word}>
      {[...word].map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="bg-surface-raised num flex size-8 items-center justify-center rounded-[8px] text-[15px] font-bold uppercase"
        >
          {ch === "#" ? "" : ch}
        </span>
      ))}
    </span>
  );
}

function Board({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[16px] p-3" style={{ background: "var(--board-bg)" }}>
      {children}
    </div>
  );
}

/**
 * One content.ts entry drawn as players meet it on the board (round 3, item 12): Two Truths and Quads use the editor
 * previews; a flag is drawn, a Pixl picture shown as its grid, a quiz question with its options (the answer marked
 * in words, not colour alone), clues as a list. Games whose board is built from one entry also get the real board
 * through "Preview board".
 */
export function ReviewEntry({ game, value }: { game: string; value: unknown }) {
  const o = (value && typeof value === "object" ? value : {}) as Obj;
  switch (game) {
    case "twotruths":
      return <TruthsPreview value={value} />;
    case "quads":
      return <QuadsPreview value={value} />;
    case "five":
      return (
        <Board>
          <Tiles word={str(value)} />
        </Board>
      );
    case "flagged":
      return (
        <Board>
          {o.flag ? <Flag spec={o.flag as FlagSpec} width={120} label={R.flagOf(str(o.name))} /> : null}
          <span className="text-[15px] font-semibold">{str(o.name)}</span>
          {o.capital ? <span className="text-[13px]">{R.capital(str(o.capital))}</span> : null}
          {o.currency ? <span className="text-[13px]">{R.currency(str(o.currency))}</span> : null}
        </Board>
      );
    case "pixl": {
      const rows = list(o.rows);
      return (
        <Board>
          <div
            role="img"
            aria-label={R.picture(str(o.name))}
            className="grid w-fit gap-px"
            style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 1}, 12px)` }}
          >
            {rows.flatMap((r, y) =>
              [...r].map((c, x) => <span key={`${y}:${x}`} className={`size-3 ${c === "#" ? "bg-[var(--text)]" : "bg-surface-raised"}`} />),
            )}
          </div>
          <span className="text-[14px] font-semibold">{str(o.name)}</span>
        </Board>
      );
    }
    case "pinned":
      return (
        <Board>
          <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">{R.map(str(o.map))}</span>
          <span className="text-[15px] font-semibold">{str(o.name)}</span>
          <span className="text-[13px]">{str(o.line)}</span>
          <span className="num text-muted text-[12px]">
            {String(o.lat)}, {String(o.lon)}
          </span>
        </Board>
      );
    case "emojihits":
      return (
        <Board>
          <span className="text-[28px] leading-none">{str(o.emoji)}</span>
          <span className="text-[13px]">
            {str(o.clue) ||
              EMOJI_COPY.clue((["song", "film", "tv"].includes(str(o.kind)) ? o.kind : "song") as "song", o.year as number, str(o.by))}
          </span>
          <span className="text-[14px] font-semibold">
            {R.answer}: {str(o.title)}
          </span>
        </Board>
      );
    case "quickfire":
      return (
        <Board>
          <span className="text-[15px] font-semibold">{str(o.q)}</span>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {[str(o.answer), ...list(o.wrong)].map((a, i) => (
              <li key={i} className="bg-surface-raised rounded-[10px] px-2.5 py-1.5 text-[13px]">
                {a}
                {i === 0 && <b className="text-accent"> ({R.answer.toLowerCase()})</b>}
              </li>
            ))}
          </ul>
        </Board>
      );
    case "hunch":
      return (
        <Board>
          <span className="text-[14px] font-semibold">{str(o.category)}</span>
          <ol className="list-decimal pl-5 text-[13px]" aria-label={R.clues}>
            {list(o.clues).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
          <span className="text-[13px]">
            {R.answer}: {list(o.accept).join(", ")}
          </span>
        </Board>
      );
    case "minicross":
      return (
        <Board>
          <div className="flex flex-col gap-1">
            {list(o.rows).map((r, i) => (
              <Tiles key={i} word={r} />
            ))}
          </div>
        </Board>
      );
    case "seven":
      return (
        <Board>
          <Tiles word={`${str(o.centre)}${str(o.letters)}`} />
          <span className="text-[13px]">
            {R.answer}: {str(o.pangram)}
          </span>
        </Board>
      );
    default:
      // Coil, Rungs, Buried, Remix: a theme or the words; "Preview board" shows the real grid.
      return (
        <Board>
          {o.theme ? <span className="text-[14px] font-semibold">{str(o.theme)}</span> : null}
          {o.phrase ? <span className="text-[13px]">{str(o.phrase)}</span> : null}
          <span className="text-[13px]">{list(o.words).join(" · ")}</span>
          {Array.isArray(o.clues) ? <span className="text-muted text-[12px]">{list(o.clues).join(" / ")}</span> : null}
        </Board>
      );
  }
}
