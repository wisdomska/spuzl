"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readFilters, withFilterParams, type FilterAllowed, type FilterDefaults } from "@/lib/admin/url-filters";

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
