import { z } from "zod";

/**
 * Admin list pagination, shared by the API routes and the console: `?page=` (1-based) and `?pageSize=`
 * (10, 25, 50 or 100; default 25). Pure, so the client, the server and the unit tests all use it.
 */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;
/** Far beyond any real list; stops absurd offsets reaching Postgres. */
export const MAX_PAGE = 100_000;

export const isPageSize = (n: number): n is PageSize => (PAGE_SIZES as readonly number[]).includes(n);

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(isPageSize, `pageSize must be one of ${PAGE_SIZES.join(", ")}`)
    .default(DEFAULT_PAGE_SIZE),
});

export interface PageParams {
  page: number;
  pageSize: PageSize;
}

/** One page of a list, as every paginated admin route returns it. */
export interface Paged<T> extends PageParams {
  rows: T[];
  total: number;
}

type Search = Pick<URLSearchParams, "get">;

/** Strict parse for the API: a missing param takes its default, anything else must be valid. */
export function parsePageQuery(sp: Search) {
  return PageQuery.safeParse({ page: sp.get("page") ?? undefined, pageSize: sp.get("pageSize") ?? undefined });
}

/** Lenient read for the console: a bad or missing value in the address bar falls back to the default. */
export function readPageParams(sp: Search): PageParams {
  const page = Number(sp.get("page"));
  const size = Number(sp.get("pageSize"));
  return {
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
    pageSize: isPageSize(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** Inclusive row offsets for Supabase `.range(from, to)`. */
export function rangeOf({ page, pageSize }: PageParams): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Number of pages; an empty list still has one (empty) page. */
export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(Math.max(0, total) / pageSize));

/** 1-based positions of the first and last row shown ("Showing 26–50 of 312"); 0 and 0 when there are none. */
export function shownRange(page: number, pageSize: number, total: number): { first: number; last: number } {
  const first = (page - 1) * pageSize + 1;
  if (total <= 0 || first > total) return { first: 0, last: 0 };
  return { first, last: Math.min(page * pageSize, total) };
}

/** Up to `width` page numbers around the current one, always inside 1..pages. */
export function pageWindow(page: number, pages: number, width = 5): number[] {
  const n = Math.min(width, pages);
  const start = Math.min(Math.max(1, page - Math.floor(n / 2)), pages - n + 1);
  return Array.from({ length: n }, (_, i) => start + i);
}

/** One page of an in-memory list (for lists that are not table-backed). */
export function slicePage<T>(items: readonly T[], p: PageParams): Paged<T> {
  const { from, to } = rangeOf(p);
  return { rows: items.slice(from, to + 1), page: p.page, pageSize: p.pageSize, total: items.length };
}

/**
 * The address-bar query string with `page` and `pageSize` set; defaults are left out so a plain list keeps a
 * clean URL. Other params are kept as they are.
 */
export function withPageParams(search: string, next: PageParams): string {
  const params = new URLSearchParams(search);
  if (next.page > 1) params.set("page", String(next.page));
  else params.delete("page");
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  else params.delete("pageSize");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** The API query string for one page. */
export const pageQueryString = ({ page, pageSize }: PageParams) => `page=${page}&pageSize=${pageSize}`;
