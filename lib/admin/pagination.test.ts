import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE,
  PAGE_SIZE_CHOICES,
  PAGE_SIZES,
  pageCount,
  pageItems,
  pageQueryString,
  pageWindow,
  parsePageQuery,
  rangeOf,
  readPageParams,
  shownRange,
  slicePage,
  withPageParams,
} from "./pagination";

const sp = (s: string) => new URLSearchParams(s);

describe("parsePageQuery (API, strict)", () => {
  it("defaults to page 1 of 25", () => {
    const r = parsePageQuery(sp(""));
    expect(r.success && r.data).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("accepts the allowed sizes and any page in range", () => {
    for (const size of [10, 25, 50, 100]) {
      const r = parsePageQuery(sp(`page=3&pageSize=${size}`));
      expect(r.success && r.data).toEqual({ page: 3, pageSize: size });
    }
    expect(parsePageQuery(sp(`page=${MAX_PAGE}`)).success).toBe(true);
  });

  it("rejects other sizes and bad pages", () => {
    for (const q of [
      "pageSize=7",
      "pageSize=0",
      "pageSize=1000",
      "pageSize=25.5",
      "pageSize=abc",
      "pageSize=",
      "page=0",
      "page=-1",
      "page=1.5",
      "page=abc",
      "page=",
      `page=${MAX_PAGE + 1}`,
    ])
      expect(parsePageQuery(sp(q)).success, q).toBe(false);
  });
});

describe("readPageParams (console, lenient)", () => {
  it("falls back to defaults for anything invalid", () => {
    expect(readPageParams(sp("page=4&pageSize=50"))).toEqual({ page: 4, pageSize: 50 });
    expect(readPageParams(sp("page=0&pageSize=7"))).toEqual({ page: 1, pageSize: 25 });
    expect(readPageParams(sp("page=x"))).toEqual({ page: 1, pageSize: 25 });
    expect(readPageParams(sp(""))).toEqual({ page: 1, pageSize: 25 });
  });
});

describe("page math", () => {
  it("maps a page to inclusive range offsets", () => {
    expect(rangeOf({ page: 1, pageSize: 25 })).toEqual({ from: 0, to: 24 });
    expect(rangeOf({ page: 2, pageSize: 25 })).toEqual({ from: 25, to: 49 });
    expect(rangeOf({ page: 3, pageSize: 10 })).toEqual({ from: 20, to: 29 });
  });

  it("counts pages, with one page for an empty list", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(312, 25)).toBe(13);
  });

  it("describes the rows shown", () => {
    expect(shownRange(2, 25, 312)).toEqual({ first: 26, last: 50 });
    expect(shownRange(13, 25, 312)).toEqual({ first: 301, last: 312 });
    expect(shownRange(1, 25, 0)).toEqual({ first: 0, last: 0 });
    expect(shownRange(5, 25, 30)).toEqual({ first: 0, last: 0 });
  });

  it("keeps a window of page buttons inside the list", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 13)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(7, 13)).toEqual([5, 6, 7, 8, 9]);
    expect(pageWindow(13, 13)).toEqual([9, 10, 11, 12, 13]);
    expect(pageWindow(2, 13)).toEqual([1, 2, 3, 4, 5]);
  });

  it("lists every page of a short list", () => {
    expect(pageItems(1, 0)).toEqual([1]);
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("adds gaps around the current page in a long list, always showing the first and last", () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageItems(5, 20)).toEqual([1, "gap", 4, 5, 6, "gap", 20]);
    expect(pageItems(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageItems(17, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
    expect(pageItems(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
    expect(pageItems(50, 8)).toEqual([1, "gap", 4, 5, 6, 7, 8]);
  });

  it("keeps the bar the same width while paging and never repeats or skips the current page", () => {
    for (const pages of [8, 13, 100, 4000])
      for (const page of [1, 2, 3, 4, 5, Math.floor(pages / 2), pages - 3, pages - 1, pages]) {
        const items = pageItems(page, pages);
        expect(items, `${page}/${pages}`).toHaveLength(7);
        expect(items).toContain(page);
        const nums = items.filter((x): x is number => x !== "gap");
        expect(nums).toEqual([...nums].sort((a, b) => a - b));
        expect(new Set(nums).size).toBe(nums.length);
        expect([nums[0], nums.at(-1)]).toEqual([1, pages]);
      }
  });

  it("widens with more siblings", () => {
    expect(pageItems(10, 20, 2)).toEqual([1, "gap", 8, 9, 10, 11, 12, "gap", 20]);
  });

  it("offers 25, 50 and 100 in the console, all valid in the API", () => {
    expect([...PAGE_SIZE_CHOICES]).toEqual([25, 50, 100]);
    for (const n of PAGE_SIZE_CHOICES) expect(PAGE_SIZES).toContain(n);
  });

  it("slices an in-memory list without repeating rows", () => {
    const items = Array.from({ length: 27 }, (_, i) => i);
    const p1 = slicePage(items, { page: 1, pageSize: 25 });
    const p2 = slicePage(items, { page: 2, pageSize: 25 });
    expect(p1).toMatchObject({ page: 1, pageSize: 25, total: 27 });
    expect(p1.rows).toHaveLength(25);
    expect(p2.rows).toEqual([25, 26]);
    expect(slicePage(items, { page: 3, pageSize: 25 }).rows).toEqual([]);
  });
});

describe("URL params", () => {
  it("writes page and size, leaving defaults and other params alone", () => {
    expect(withPageParams("?tab=flagged", { page: 3, pageSize: 50 })).toBe("?tab=flagged&page=3&pageSize=50");
    expect(withPageParams("?tab=flagged&page=3&pageSize=50", { page: 1, pageSize: 25 })).toBe("?tab=flagged");
    expect(withPageParams("", { page: 1, pageSize: 25 })).toBe("");
    expect(withPageParams("page=2", { page: 2, pageSize: 10 })).toBe("?page=2&pageSize=10");
  });

  it("builds the API query", () => {
    expect(pageQueryString({ page: 2, pageSize: 10 })).toBe("page=2&pageSize=10");
  });
});
