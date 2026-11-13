"use client";

import { useCallback, useState } from "react";
import { toggleSort, type SortSpec, type SortState } from "@/lib/admin/sorting";
import type { UrlSort } from "./useUrlFilters";

/**
 * Sorting for a table the page already holds in full (a player's games, reports, ranks), with the same headers as
 * the server-sorted lists (SortHead): press a column to sort by it, press again to flip.
 */
export function useLocalSort<K extends string>(spec: SortSpec<K>): UrlSort<K> {
  const [state, setState] = useState<SortState<K>>({ sort: spec.default, dir: spec.dir });
  const toggle = useCallback((key: K) => setState((s) => toggleSort(s, key, spec)), [spec]);
  return { ...state, query: `sort=${state.sort}&dir=${state.dir}`, toggle };
}

/** Sorted copy by a value per column: numbers and dates by value, text alphabetically; empty values go last. */
export function sortBy<T, K extends string>(
  rows: readonly T[],
  s: SortState<K>,
  value: (row: T, key: K) => string | number | null | undefined,
): T[] {
  const sign = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a, s.sort);
    const y = value(b, s.sort);
    if (x === null || x === undefined || y === null || y === undefined) return x === y ? 0 : x === null || x === undefined ? 1 : -1;
    if (typeof x === "number" && typeof y === "number") return sign * (x - y);
    return sign * String(x).localeCompare(String(y));
  });
}
