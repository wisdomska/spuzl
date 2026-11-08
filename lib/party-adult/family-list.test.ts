import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILY_DRAW_WORDS, FAMILY_OPTIONS, familyOptions } from "./family";
import { activeRows, familyListFrom, MIN_FAMILY_WORDS, rowToWord, type FamilyWordRow } from "./family-list";

const row = (word: string, sort: number, extra: Partial<FamilyWordRow> = {}): FamilyWordRow => ({
  id: `id-${word}`,
  word,
  alt: [],
  sort,
  retired_at: null,
  ...extra,
});

describe("Family Draw words from the database (round 3, item 11)", () => {
  it("deals the table's active words in list order, without retired ones", () => {
    const rows = [
      row("mango", 2),
      row("kente", 1, { alt: ["kente cloth"] }),
      row("tent", 3, { retired_at: "2026-11-08T00:00:00Z" }),
      row("yam", 4),
      row("drum", 5),
    ];
    const r = familyListFrom(rows);
    expect(r.source).toBe("db");
    expect(r.words).toEqual([{ word: "kente", alt: ["kente cloth"] }, { word: "mango" }, { word: "yam" }, { word: "drum" }]);
  });

  it("falls back to the code list only while the table can't fill a round (empty, unreadable, under four active)", () => {
    expect(familyListFrom([])).toEqual({ words: FAMILY_DRAW_WORDS, source: "code" });
    expect(familyListFrom(null).source).toBe("code");
    const three = [row("a b", 1), row("cd", 2), row("ef", 3)];
    expect(familyListFrom(three).source).toBe("code");
    expect(familyListFrom([...three, row("gh", 4)]).source).toBe("db");
    expect(familyListFrom([...three, row("gh", 4, { retired_at: "2026-11-08T00:00:00Z" })]).source).toBe("code");
  });

  it("gives four options from the stored list, never a retired word", () => {
    const rows = [row("mango", 1), row("kente", 2), row("yam", 3), row("tent", 4), row("drum", 5, { retired_at: "x" })];
    const { words } = familyListFrom(rows);
    for (let i = 0; i < 20; i++) {
      const o = familyOptions("mango", (n) => (i + n) % n, words);
      expect(o).toHaveLength(FAMILY_OPTIONS);
      expect(o).not.toContain("drum");
    }
  });

  it("keeps a real pool: the minimum is well above one round's four options", () => {
    expect(MIN_FAMILY_WORDS).toBeGreaterThanOrEqual(FAMILY_OPTIONS * 3);
    expect(activeRows([row("b", 1), row("a", 1)]).map((r) => r.word)).toEqual(["a", "b"]);
    expect(rowToWord({ word: "x", alt: null })).toEqual({ word: "x" });
  });

  it("is seeded by the migration with exactly the code list, in order", () => {
    const sql = fs.readFileSync("supabase/migrations/20261207001101_family_draw_words.sql", "utf8");
    const seeded = [...sql.matchAll(/^ {2}\('([a-z ]+)', (?:'\{\}'::text\[\]|array\[([^\]]*)\]), (\d+)\)/gm)].map((m) => ({
      word: m[1],
      alt: m[2] ? [...m[2].matchAll(/'([a-z ]+)'/g)].map((a) => a[1]) : [],
      sort: Number(m[3]),
    }));
    expect(seeded.map((s) => rowToWord(s))).toEqual(FAMILY_DRAW_WORDS.map((w) => rowToWord({ word: w.word, alt: w.alt ?? [] })));
    expect(seeded.map((s) => s.sort)).toEqual(seeded.map((_, i) => i + 1));
  });
});
