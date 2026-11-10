import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { SupabaseClient } from "@supabase/supabase-js";
import { POOL_SEED, pickPooled, pooledEntry, pooledItemOf } from "./quads-pool";
import { POOL_INDEX, boardFor, checkGuess, contentCount, generateAt, verify } from "@/games/quads/logic";
import type { QuadsEntry } from "@/games/quads/content";

const ID = "c4150000-0000-4000-8000-000000000001";
const ENTRY: QuadsEntry = {
  groups: [
    { label: "Fruits", words: ["MANGO", "PAWPAW", "ORANGE", "PEAR"] },
    { label: "Colours", words: ["RED", "BLUE", "GREEN", "PINK"] },
    { label: "Days", words: ["MONDAY", "FRIDAY", "SUNDAY", "TUESDAY"] },
    { label: "Planets", words: ["MARS", "VENUS", "SATURN", "EARTH"] },
  ],
};

/** A content_items read that returns `row` for any id. */
const dbWith = (row: unknown) =>
  ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) }) as unknown as SupabaseClient;

describe("Quads free-play pool (R4-15)", () => {
  it("deals pooled items and built-in entries evenly", () => {
    const ids = ["a", "b"];
    // 2 pooled + 3 built-in: draws 0 and 1 are pooled, 2..4 are built-in boards.
    expect(pickPooled(ids, 3, () => 0)).toBe("a");
    expect(pickPooled(ids, 3, () => 1)).toBe("b");
    expect(pickPooled(ids, 3, () => 2)).toBeNull();
    expect(pickPooled(ids, 3, () => 4)).toBeNull();
    expect(pickPooled([], contentCount, () => 0)).toBeNull();
    let n = 0;
    pickPooled(ids, contentCount, (k) => ((n = k), 0));
    expect(n).toBe(ids.length + contentCount);
  });

  it("reads the item back from its seed only", () => {
    expect(pooledItemOf(`${POOL_SEED}${ID}:5b0c`)).toBe(ID);
    expect(pooledItemOf(`free:quads:${ID}`)).toBeNull();
    expect(pooledItemOf(`${POOL_SEED}not-an-id:5b0c`)).toBeNull();
  });

  it("builds the same board from the same seed, past every built-in index, with the groups kept server side", () => {
    const seed = `${POOL_SEED}${ID}:5b0c`;
    const a = boardFor(ENTRY, POOL_INDEX, "easy", seed);
    const b = boardFor(ENTRY, POOL_INDEX, "easy", seed);
    expect(a).toEqual(b);
    expect((a.puzzle.ref as { i: number }).i).toBeGreaterThan(contentCount);
    expect([...a.puzzle.words].sort()).toEqual(ENTRY.groups.flatMap((g) => g.words).sort());
    expect(JSON.stringify(a.puzzle)).not.toContain("Planets");
    expect(checkGuess(a.puzzle, a.solution, ["MARS", "VENUS", "SATURN", "EARTH"]).ok).toBe(true);
    expect(verify(a.puzzle, a.solution, { guesses: ENTRY.groups.map((g) => [...g.words]) }).ok).toBe(true);
  });

  it("keeps built-in boards as they were", () => {
    const g = generateAt(3, "medium");
    expect((g.puzzle.ref as { i: number }).i).toBe(3);
    expect(g.puzzle.words).toHaveLength(16);
  });

  it("loads only a valid editor Quads item", async () => {
    expect(await pooledEntry(dbWith({ payload: ENTRY, game_id: "quads", source: "editor" }), ID)).toEqual(ENTRY);
    expect(await pooledEntry(dbWith({ payload: ENTRY, game_id: "coil", source: "editor" }), ID)).toBeNull();
    expect(await pooledEntry(dbWith({ payload: ENTRY, game_id: "quads", source: "content_file" }), ID)).toBeNull();
    expect(await pooledEntry(dbWith({ payload: { groups: [] }, game_id: "quads", source: "editor" }), ID)).toBeNull();
    expect(await pooledEntry(dbWith(null), ID)).toBeNull();
  });
});
