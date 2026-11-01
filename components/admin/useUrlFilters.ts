"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readFilters, withFilterParams, type FilterAllowed, type FilterDefaults } from "@/lib/admin/url-filters";
import { readSortParams, sortQueryString, toggleSort, withSortParams, type SortSpec, type SortState } from "@/lib/admin/sorting";

export type SetFilters<K extends string> = (patch: Partial<Record<K, string | null>>, opts?: { replace?: boolean }) => void;

/**
 * Filters for an admin list, kept in the address bar next to `?page=&pageSize=` (see `usePager`). Changing a
 * filter goes back to page 1 in the same history entry, so callers don't need `pager.reset()`.
 *
 * Pass `defaults` and `allowed` as module-level constants: they are read on every render but not tracked.
 * Tabs and selects push a history entry (Back undoes the change); text fields pass `replace: true`.
 */
export function useUrlFilters<K extends string>(
  defaults: FilterDefaults<K>,
  allowed?: FilterAllowed<K>,
): [Record<K, string>, SetFilters<K>] {
  const sp = useSearchParams();
  const values = readFilters(sp, defaults, allowed);
  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  });
  const set = useCallback<SetFilters<K>>((patch, opts = {}) => {
    const search = withFilterParams(window.location.search, patch, defaultsRef.current);
    if (search === window.location.search) return;
    const url = `${window.location.pathname}${search}`;
    if (opts.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }, []);
  return [values, set];
}

/**
 * A text filter that types into local state and writes the address bar after a short pause, so the caret
 * never jumps and each keystroke doesn't fire a request. Follows the URL when it changes from elsewhere (Back).
 */
export function useDebouncedFilter(value: string, write: (v: string) => void, delay = 300): [string, (v: string) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = useCallback(
    (v: string) => {
      setDraft(v);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => write(v), delay);
    },
    [write, delay],
  );
  return [draft, change];
}

export interface UrlSort<K extends string> extends SortState<K> {
  /** `sort=&dir=` for the API call. */
  query: string;
  /** A header was pressed: same column flips, a new column starts in its first direction. Back undoes it. */
  toggle: (key: K) => void;
}

/**
 * The sort of an admin list, kept in the address bar (`?sort=&dir=`) next to the filters and page. The default
 * sort keeps a clean URL; any change goes back to page 1. Pass `spec` as a module-level constant.
 */
export function useUrlSort<K extends string>(spec: SortSpec<K>): UrlSort<K> {
  const sp = useSearchParams();
  const state = readSortParams(sp, spec);
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  });
  // Reads the address bar at press time, so the callback never goes stale and needs no dependencies.
  const toggle = useCallback((key: K) => {
    const s = specRef.current;
    const next = toggleSort(readSortParams(new URLSearchParams(window.location.search), s), key, s);
    window.history.pushState(null, "", `${window.location.pathname}${withSortParams(window.location.search, next, s)}`);
  }, []);
  return { ...state, query: sortQueryString(state), toggle };
}
