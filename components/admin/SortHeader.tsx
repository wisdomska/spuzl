"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ariaSort } from "@/lib/admin/sorting";
import { adminCopy } from "@/lib/copy/admin";
import type { UrlSort } from "./useUrlFilters";

export interface HeadCol<K extends string> {
  label: string;
  /** Sortable when set: the API's sort key for this column. */
  sort?: K;
  /** Visually hidden label (action and checkbox columns). */
  hidden?: boolean;
  /** Replaces the label in the cell (a select-all checkbox); the label stays as the accessible name. */
  content?: ReactNode;
  className?: string;
}

/**
 * Table header row for admin lists. Sortable columns get a real button inside the `<th>` (44 px tall), `aria-sort`
 * on the header and an arrow for the current direction; the others stay plain text. The server does the sorting.
 */
export function SortHead<K extends string>({ cols, sort }: { cols: HeadCol<K>[]; sort?: UrlSort<K> }) {
  return (
    <thead>
      <tr className="bg-surface-raised num text-muted text-left text-[12px]">
        {cols.map((c, i) => {
          const key = c.sort;
          if (!key || !sort)
            return (
              <th key={i} scope="col" className={`px-3 py-2.5 font-semibold ${c.className ?? ""}`}>
                {c.content ?? (c.hidden ? <span className="sr-only">{c.label}</span> : c.label)}
              </th>
            );
          const state = ariaSort(sort, key);
          const next = state === "ascending" ? "descending" : "ascending";
          return (
            <th key={i} scope="col" aria-sort={state} className={`px-1.5 py-0 font-semibold ${c.className ?? ""}`}>
              <button
                type="button"
                onClick={() => sort.toggle(key)}
                title={adminCopy.sort.by(c.label, next)}
                className={`hover:bg-line/60 flex h-11 w-full items-center gap-1 rounded-[8px] px-1.5 text-left whitespace-nowrap ${state === "none" ? "" : "text-text"}`}
              >
                {c.label}
                <Icon
                  name={state === "ascending" ? "caret-up" : state === "descending" ? "caret-down" : "arrows-down-up"}
                  size={14}
                  className={state === "none" ? "opacity-40" : ""}
                />
              </button>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
