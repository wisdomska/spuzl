import { describe, expect, it } from "vitest";
import {
  AUDIT_SORT,
  CATALOG_SORT,
  CONTENT_SORT,
  EVENT_SORT,
  MODERATION_SORT,
  PLAYER_SORT,
  PUZZLE_SORT,
  TEAM_SORT,
  ariaSort,
  parseSortQuery,
  readSortParams,
  sortQueryString,
  sortSpec,
  toggleSort,
  withSortParams,
  type SortSpec,
} from "./sorting";

const sp = (s: string) => new URLSearchParams(s);
const SPEC = sortSpec({ keys: ["joined", "nickname", "sparks"], default: "joined", dir: "desc", firstDir: { sparks: "desc" } });

describe("parseSortQuery (API, strict)", () => {
  it("defaults when nothing is given", () => {
    expect(parseSortQuery(sp(""), SPEC)).toEqual({ success: true, data: { sort: "joined", dir: "desc" } });
  });

  it("accepts allow-listed columns and both directions", () => {
    expect(parseSortQuery(sp("sort=nickname&dir=asc"), SPEC)).toEqual({ success: true, data: { sort: "nickname", dir: "asc" } });
    expect(parseSortQuery(sp("sort=nickname&dir=desc"), SPEC)).toEqual({ success: true, data: { sort: "nickname", dir: "desc" } });
  });

  it("uses the column's first direction when dir is missing", () => {
    expect(parseSortQuery(sp("sort=sparks"), SPEC)).toEqual({ success: true, data: { sort: "sparks", dir: "desc" } });
    expect(parseSortQuery(sp("sort=nickname"), SPEC)).toEqual({ success: true, data: { sort: "nickname", dir: "asc" } });
  });

  it("rejects columns off the allow-list, SQL-ish input and bad directions", () => {
    for (const q of ["sort=email", "sort=", "sort=nickname;drop", "sort=id%20desc", "dir=up", "dir=", "sort=nickname&dir=ASC"])
      expect(parseSortQuery(sp(q), SPEC).success, q).toBe(false);
  });
});

describe("readSortParams (console, lenient)", () => {
  it("falls back to the default for anything invalid", () => {
    expect(readSortParams(sp("sort=bogus&dir=asc"), SPEC)).toEqual({ sort: "joined", dir: "desc" });
    expect(readSortParams(sp("sort=nickname&dir=sideways"), SPEC)).toEqual({ sort: "nickname", dir: "asc" });
    expect(readSortParams(sp("sort=sparks&dir=asc"), SPEC)).toEqual({ sort: "sparks", dir: "asc" });
  });
});

describe("toggleSort", () => {
  it("flips the current column and starts a new one in its first direction", () => {
    expect(toggleSort({ sort: "nickname", dir: "asc" }, "nickname", SPEC)).toEqual({ sort: "nickname", dir: "desc" });
    expect(toggleSort({ sort: "nickname", dir: "desc" }, "nickname", SPEC)).toEqual({ sort: "nickname", dir: "asc" });
    expect(toggleSort({ sort: "nickname", dir: "asc" }, "sparks", SPEC)).toEqual({ sort: "sparks", dir: "desc" });
    expect(toggleSort({ sort: "sparks", dir: "asc" }, "joined", SPEC)).toEqual({ sort: "joined", dir: "desc" });
  });
});

describe("withSortParams", () => {
  it("writes the sort, drops the page and keeps other params", () => {
    expect(withSortParams("?page=3&pageSize=50&status=banned", { sort: "nickname", dir: "asc" }, SPEC)).toBe(
      "?pageSize=50&status=banned&sort=nickname&dir=asc",
    );
  });

  it("leaves the default sort out of the URL", () => {
    expect(withSortParams("?sort=nickname&dir=asc&page=2", { sort: "joined", dir: "desc" }, SPEC)).toBe("");
    expect(withSortParams("", { sort: "joined", dir: "asc" }, SPEC)).toBe("?sort=joined&dir=asc");
  });

  it("builds the API query and aria-sort", () => {
    expect(sortQueryString({ sort: "sparks", dir: "desc" })).toBe("sort=sparks&dir=desc");
    expect(ariaSort({ sort: "sparks", dir: "desc" }, "sparks")).toBe("descending");
    expect(ariaSort({ sort: "sparks", dir: "asc" }, "sparks")).toBe("ascending");
    expect(ariaSort({ sort: "sparks", dir: "asc" }, "nickname")).toBe("none");
  });
});

describe("list specs", () => {
  const specs: [string, SortSpec][] = [
    ["puzzles", PUZZLE_SORT],
    ["moderation", MODERATION_SORT],
    ["content", CONTENT_SORT],
    ["audit", AUDIT_SORT],
    ["events", EVENT_SORT],
    ["team", TEAM_SORT],
    ["players", PLAYER_SORT],
    ...Object.entries(CATALOG_SORT).map(([k, v]) => [`catalog.${k}`, v] as [string, SortSpec]),
  ];
  it.each(specs)("%s: the default and first directions name allow-listed columns, all plain identifiers", (_, spec) => {
    expect(spec.keys).toContain(spec.default);
    for (const k of Object.keys(spec.firstDir ?? {})) expect(spec.keys).toContain(k);
    for (const k of spec.keys) expect(k).toMatch(/^[a-z_]+$/);
    expect(new Set(spec.keys).size).toBe(spec.keys.length);
  });

  it("players sort on every column the owner asked for", () => {
    expect([...PLAYER_SORT.keys].sort()).toEqual(
      ["account", "age_band", "joined", "last_active", "level", "nickname", "reports", "sparks", "streak"].sort(),
    );
  });
});
