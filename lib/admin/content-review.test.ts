import { describe, expect, it } from "vitest";
import { can, ROLES } from "./roles";
import {
  canonical,
  editedEntry,
  filterEntries,
  isReviewed,
  reviewFrom,
  stateOf,
  summarise,
  type EntryState,
  type ReviewRow,
} from "./content-review";

const row = (status: string, hash = "h1", edited = false): ReviewRow => ({ source_ref: "g:0", source_hash: hash, status, edited });

describe("content review queue (round 3, item 12)", () => {
  it("reads an entry's state from its review row while the code entry is unchanged", () => {
    expect(stateOf(undefined, "h1")).toBe("pending");
    expect(stateOf(row("approved"), "h1")).toBe("approved");
    expect(stateOf(row("approved", "h1", true), "h1")).toBe("edited");
    expect(stateOf(row("retired"), "h1")).toBe("retired");
    expect(stateOf(row("rejected"), "h1")).toBe("retired"); // the owner's earlier "reject"
    expect(stateOf(row("approved", "old"), "h1")).toBe("changed"); // edited in code since: back in the queue
    expect(stateOf(row("retired", "old"), "h1")).toBe("changed");
  });

  it("deals what the reviews say: retired entries out, edited ones swapped in", () => {
    const r = reviewFrom([
      { index: 0, state: "approved" },
      { index: 1, state: "retired" },
      { index: 2, state: "edited", edit: { q: "fixed" } },
      { index: 3, state: "changed" },
      { index: 4, state: "pending" },
    ]);
    expect([...r.retired]).toEqual([1]);
    expect([...r.edited]).toEqual([[2, { q: "fixed" }]]);
  });

  it("derives needsReview: it clears once every entry is reviewed, and only for content the code marks", () => {
    const states: EntryState[] = ["approved", "edited", "retired", "pending", "changed"];
    expect(summarise(states, true)).toEqual({
      total: 5,
      reviewed: 3,
      approved: 1,
      edited: 1,
      retired: 1,
      changed: 1,
      pending: 1,
      needsReview: true,
    });
    expect(summarise(["approved", "retired", "edited"], true).needsReview).toBe(false);
    expect(summarise(["pending"], false).needsReview).toBe(false);
    expect(states.filter(isReviewed)).toEqual(["approved", "edited", "retired"]);
  });

  it("filters by state (to do = pending or changed) and searches the entry players get", () => {
    const list = [
      { index: 0, state: "pending" as const, entry: { q: "Capital of Ghana?" } },
      { index: 1, state: "changed" as const, entry: { q: "Volta" } },
      { index: 2, state: "edited" as const, entry: { q: "old text" }, edit: { q: "New Kente text" } },
      { index: 3, state: "retired" as const, entry: { q: "Gone" } },
    ];
    expect(filterEntries(list, "todo").map((e) => e.index)).toEqual([0, 1]);
    expect(filterEntries(list, "retired").map((e) => e.index)).toEqual([3]);
    expect(filterEntries(list, "all", "kente").map((e) => e.index)).toEqual([2]);
    expect(filterEntries(list, "all", "old text")).toEqual([]);
  });

  it("keeps fields the schema doesn't list when storing an edit", () => {
    expect(editedEntry({ id: "gh-1", q: " Raw ", extra: 1 }, { q: "Raw" })).toEqual({ id: "gh-1", q: "Raw", extra: 1 });
    expect(editedEntry(" mango ", "MANGO")).toBe("MANGO");
  });

  it("compares entries the way jsonb stores them (keys in any order)", () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: "x" }] })).toBe(canonical({ a: [{ c: "x", d: 2 }], b: 1 }));
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
    expect(canonical("MANGO")).toBe('"MANGO"');
  });

  it("lets content editors and the owner review, and every content reader view", () => {
    expect(ROLES.filter((r) => can(r, "content.write"))).toEqual(["owner", "content_editor"]);
    expect(ROLES.filter((r) => can(r, "content.read"))).toEqual(["owner", "content_editor"]);
  });
});
