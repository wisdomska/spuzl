import { describe, expect, it } from "vitest";
import { listSearch, readFilters, withFilterParams } from "./url-filters";

const sp = (s: string) => new URLSearchParams(s);
const DEFAULTS = { tab: "reports", status: "open", q: "" } as const;
const ALLOWED = { tab: ["reports", "nicknames", "flagged"], status: ["open", "actioned", "dismissed", "all"] } as const;

describe("readFilters", () => {
  it("reads set values and falls back to defaults", () => {
    expect(readFilters(sp("tab=flagged&q=abc"), DEFAULTS, ALLOWED)).toEqual({ tab: "flagged", status: "open", q: "abc" });
    expect(readFilters(sp(""), DEFAULTS, ALLOWED)).toEqual({ tab: "reports", status: "open", q: "" });
  });

  it("ignores values outside the allowed set and empty values", () => {
    expect(readFilters(sp("tab=nope&status="), DEFAULTS, ALLOWED)).toEqual({ tab: "reports", status: "open", q: "" });
  });

  it("accepts any value when no allowed set is given", () => {
    expect(readFilters(sp("status=weird"), DEFAULTS)).toMatchObject({ status: "weird" });
  });
});

describe("withFilterParams", () => {
  it("sets a filter, drops the page and keeps the page size and other params", () => {
    expect(withFilterParams("?page=4&pageSize=50&x=1", { status: "all" }, DEFAULTS)).toBe("?pageSize=50&x=1&status=all");
  });

  it("removes params equal to the default, empty or null", () => {
    expect(withFilterParams("?status=all&tab=flagged&q=a", { status: "open", tab: null, q: "" }, DEFAULTS)).toBe("");
  });

  it("drops the page even when nothing else changes", () => {
    expect(withFilterParams("?page=2", {}, DEFAULTS)).toBe("");
  });
});

describe("listSearch", () => {
  it("re-encodes a list query string and ignores anything else", () => {
    expect(listSearch("?game=nine&page=3")).toBe("?game=nine&page=3");
    expect(listSearch("status=in_review")).toBe("?status=in_review");
    expect(listSearch("")).toBe("");
    expect(listSearch(undefined)).toBe("");
    expect(listSearch(["a=1"])).toBe("");
    expect(listSearch("//evil.example/x")).toBe("?%2F%2Fevil.example%2Fx=");
  });
});
