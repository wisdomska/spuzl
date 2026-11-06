"use client";

import { forwardRef } from "react";
import { WORLDS, type World } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { TAGS, type GameFilter } from "@/lib/games-meta";
import { libraryCopy as T } from "@/lib/copy/library";

/**
 * The Library's search box and filter chips (SPZ-14), shared by All games and the Duel game picker so both
 * look, read and behave the same. Filtering itself is `filterGames` (lib/games-meta).
 */
export const GameSearchField = forwardRef<HTMLInputElement, { value: string; onChange: (q: string) => void; placeholder?: string }>(
  function GameSearchField({ value, onChange, placeholder = T.searchPlaceholder }, ref) {
    return (
      <div className="bg-surface focus-within:ring-accent flex h-12 items-center gap-2.5 rounded-[16px] px-3.5 focus-within:ring-2">
        <Icon name="magnifying-glass" size={20} className="text-muted shrink-0" />
        <input
          ref={ref}
          type="search"
          aria-label={T.search}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-[16px] outline-none focus-visible:shadow-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          enterKeyHint="search"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            aria-label={T.clear}
            onClick={() => onChange("")}
            className="press -mr-1.5 flex size-11 items-center justify-center"
          >
            <Icon name="x" size={18} className="text-muted" />
          </button>
        )}
      </div>
    );
  },
);

/**
 * All, New (R2-18, only while some game in the list is new: `showNew`), the other tags, then the worlds (pass
 * `worlds` to show only those that hold games in the list).
 */
export function GameFilterChips({
  value,
  onChange,
  worlds = WORLDS,
  showNew = false,
}: {
  value: GameFilter;
  onChange: (f: GameFilter) => void;
  worlds?: readonly World[];
  showNew?: boolean;
}) {
  const tags = [...(showNew || value === "new" ? (["new"] as const) : []), ...TAGS.filter((t) => t !== "new")];
  const chips: { id: GameFilter; label: string; title?: string; color?: string }[] = [
    { id: "all", label: T.all },
    ...tags.map((t) => ({ id: t as GameFilter, label: T.tag[t], title: T.tagHelp[t] })),
    ...worlds.map((w) => ({ id: w.id as GameFilter, label: w.name, color: w.color })),
  ];
  return (
    <div className="edge-fade -mx-4">
      <div role="group" aria-label={T.filters} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
        {chips.map((c) => {
          const on = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              title={c.title}
              onClick={() => onChange(on && c.id !== "all" ? "all" : c.id)}
              className="press flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[14px] font-semibold whitespace-nowrap"
              style={
                on
                  ? { background: c.color ?? "var(--accent)", color: c.color ? "var(--bg)" : "var(--on-accent)" }
                  : { background: "var(--surface)", color: "var(--text-muted)" }
              }
            >
              {c.color && !on && <span aria-hidden className="size-2.5 rounded-full" style={{ background: c.color }} />}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
