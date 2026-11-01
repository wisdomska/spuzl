"use client";

import { useCallback, useEffect, useId, useState } from "react";
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
import { Btn, inputCls } from "./ui";

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
 * Accessible pagination bar for admin tables: "Showing 26–50 of 312", rows per page (25, 50 or 100), First,
 * Previous, numbered pages with gaps (always the first and last), Next, Last and a jump-to-page field. 44 px
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
      <label htmlFor={`${id}-size`} className="text-muted flex items-center gap-2 text-[13px] font-semibold">
        {C.rows}
        <select
          id={`${id}-size`}
          value={pageSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (isPageSize(n)) setPageSize(n);
          }}
          className={`${inputCls} num h-11 w-20`}
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
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
        {pages > 1 && <PageJump key={current} page={current} pages={pages} onGo={setPage} id={`${id}-jump`} />}
      </div>
    </nav>
  );
}

function PageJump({ page, pages, onGo, id }: { page: number; pages: number; onGo: (p: number) => void; id: string }) {
  const [text, setText] = useState(String(page));
  const n = Number(text);
  const valid = Number.isInteger(n) && n >= 1 && n <= pages;
  return (
    <form
      aria-label={C.jumpAria}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onGo(n);
      }}
    >
      <label htmlFor={id} className="text-muted text-[13px] font-semibold">
        {C.page}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={pages}
        value={text}
        aria-invalid={!valid}
        aria-describedby={`${id}-of`}
        onChange={(e) => setText(e.target.value)}
        className={`${inputCls} num h-11 w-20`}
      />
      <span id={`${id}-of`} className="num text-muted text-[13px]">
        {C.of(pages.toLocaleString("en-US"))}
      </span>
      <Btn type="submit" size="lg" disabled={!valid || n === page}>
        {C.go}
      </Btn>
    </form>
  );
}
