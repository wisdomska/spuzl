"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import {
  PAGE_SIZE_CHOICES,
  isPageSize,
  pageCount,
  pageItems,
  pageQueryString,
  readPageParams,
  shownRange,
  withPageParams,
  type PageParams,
  type PageSize,
} from "@/lib/admin/pagination";
import { adminCopy } from "@/lib/copy/admin";
import { Btn } from "./ui";
import { Select } from "@/components/ui/Select";

const C = adminCopy.pagination;

export interface Pager extends PageParams {
  /** `page=&pageSize=` for the API call. */
  query: string;
  /** Moves to a page (a new history entry, so Back returns to the previous page). */
  setPage: (page: number, opts?: { replace?: boolean }) => void;
  /** Changes the page size and goes back to page 1. */
  setPageSize: (size: PageSize) => void;
  /** Back to page 1 without a history entry: call it whenever a filter, tab or search changes. */
  reset: () => void;
}

/**
 * Page and page size for an admin list, kept in the address bar (`?page=&pageSize=`) so a reload or a shared
 * link opens the same page. Uses the native History API, which Next.js syncs with useSearchParams without a
 * server round trip.
 */
export function usePager(): Pager {
  const sp = useSearchParams();
  const { page, pageSize } = readPageParams(sp);
  const write = useCallback((next: PageParams, replace: boolean) => {
    const url = `${window.location.pathname}${withPageParams(window.location.search, next)}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }, []);
  const setPage = useCallback(
    (p: number, opts: { replace?: boolean } = {}) => {
      if (p !== page) write({ page: Math.max(1, p), pageSize }, !!opts.replace);
    },
    [page, pageSize, write],
  );
  const setPageSize = useCallback((size: PageSize) => write({ page: 1, pageSize: size }, false), [write]);
  const reset = useCallback(() => {
    if (page !== 1) write({ page: 1, pageSize }, true);
  }, [page, pageSize, write]);
  return { page, pageSize, query: pageQueryString({ page, pageSize }), setPage, setPageSize, reset };
}

/**
 * Page and page size held on the page itself (not in the address bar): for a long list that loads all at once,
 * or for several lists on one page (a player's history), where one `?page=` can't serve them all.
 */
export function useLocalPager(initialSize = 25): Pager {
  const [state, setState] = useState<PageParams>({ page: 1, pageSize: initialSize as PageSize });
  const setPage = useCallback((p: number) => setState((s) => ({ ...s, page: Math.max(1, p) })), []);
  const setPageSize = useCallback((size: PageSize) => setState({ page: 1, pageSize: size }), []);
  const reset = useCallback(() => setState((s) => (s.page === 1 ? s : { ...s, page: 1 })), []);
  return { ...state, query: pageQueryString(state), setPage, setPageSize, reset };
}

/** One page of `items` for `pager`. */
export function pageOf<T>(items: readonly T[], pager: Pick<Pager, "page" | "pageSize">): readonly T[] {
  return items.slice((pager.page - 1) * pager.pageSize, pager.page * pager.pageSize);
}

/**
 * A long list shown a page at a time (`size` rows), with the pagination bar under it once there is more than one
 * page. `children` draws the rows of the current page.
 */
export function Paged<T>({
  items,
  size = 10,
  label,
  children,
}: {
  items: readonly T[];
  size?: number;
  label: string;
  children: (rows: readonly T[]) => ReactNode;
}) {
  const pager = useLocalPager(size);
  return (
    <>
      {children(pageOf(items, pager))}
      {items.length > size && (
        <div className="pt-3">
          <Pagination pager={pager} total={items.length} label={label} />
        </div>
      )}
    </>
  );
}

/**
 * Accessible pagination bar for admin tables: "Showing 26–50 of 312", rows per page (25, 50 or 100), First,
 * Previous, numbered pages with gaps (always the first and last), Next and Last (the jump-to-page field was
 * removed at the owner's request). 44 px
 * targets, real buttons, disabled ends. Steps back to the last page by itself when the current one no longer
 * exists (rows resolved or deleted).
 */
export function Pagination({ pager, total, label = C.label }: { pager: Pager; total: number; label?: string }) {
  const { page, pageSize, setPage, setPageSize } = pager;
  const pages = pageCount(total, pageSize);
  const { first, last } = shownRange(page, pageSize, total);
  const id = useId();

  useEffect(() => {
    if (total > 0 && page > pages) setPage(pages, { replace: true });
  }, [total, page, pages, setPage]);

  if (total <= 0) return null;
  const current = Math.min(page, pages);
  const items = pageItems(current, pages);
  const sizes: number[] = (PAGE_SIZE_CHOICES as readonly number[]).includes(pageSize)
    ? [...PAGE_SIZE_CHOICES]
    : [pageSize, ...PAGE_SIZE_CHOICES];
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="num text-muted text-[13px] font-medium" aria-live="polite" aria-atomic="true">
        {C.showing(fmt(first), fmt(last), fmt(total))}
      </p>
      <div className="text-muted flex items-center gap-2 text-[13px] font-semibold">
        <label htmlFor={`${id}-size`}>{C.rows}</label>
        <Select
          id={`${id}-size`}
          value={String(pageSize)}
          onValueChange={(v) => {
            const n = Number(v);
            if (isPageSize(n)) setPageSize(n);
          }}
          options={sizes.map((s) => ({ value: String(s), label: String(s) }))}
          className="num h-11 w-20"
        />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Btn size="lg" disabled={page <= 1} onClick={() => setPage(1)} aria-label={C.firstAria} className="max-md:hidden">
          {C.first}
        </Btn>
        <Btn size="lg" icon="caret-left" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={C.previousAria}>
          <span className="max-sm:sr-only">{C.previous}</span>
        </Btn>
        <ul className="flex items-center gap-1">
          {items.map((n, i) =>
            n === "gap" ? (
              <li key={`gap-${i}`} aria-hidden className="num text-muted flex h-11 w-6 items-center justify-center text-[14px]">
                …
              </li>
            ) : (
              <li key={n}>
                <button
                  type="button"
                  aria-label={C.pageAria(n)}
                  aria-current={n === current ? "page" : undefined}
                  onClick={() => setPage(n)}
                  className={`num inline-flex h-11 min-w-11 items-center justify-center rounded-[12px] px-2 text-[14px] font-semibold ${
                    n === current ? "bg-accent text-on-accent" : "text-muted hover:bg-surface-raised hover:text-text"
                  }`}
                >
                  {fmt(n)}
                </button>
              </li>
            ),
          )}
        </ul>
        <Btn size="lg" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={C.nextAria}>
          <span className="max-sm:sr-only">{C.next}</span>
          <Icon name="caret-right" size={16} />
        </Btn>
        <Btn
          size="lg"
          disabled={page >= pages}
          onClick={() => setPage(pages)}
          aria-label={C.lastAria(fmt(pages))}
          className="max-md:hidden"
        >
          {C.last}
        </Btn>
      </div>
    </nav>
  );
}
