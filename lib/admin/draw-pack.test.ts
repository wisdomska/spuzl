import { describe, expect, it } from "vitest";
import { FAMILY_DRAW_WORDS } from "@/lib/party-adult/family";
import { activeAfter, checkDrawWord, drawPackDiff, drawPackToJson, MAX_DRAW_PACK, parseDrawPack, planDrawImport } from "./draw-pack";

describe("Family Draw word packs (admin export and check, R2-P5)", () => {
  it("round-trips the whole list: export, check, export gives the same file", () => {
    const text = drawPackToJson(FAMILY_DRAW_WORDS);
    const back = parseDrawPack(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.items).toEqual(FAMILY_DRAW_WORDS.map((w) => (w.alt?.length ? { word: w.word, alt: [...w.alt] } : { word: w.word })));
    expect(drawPackToJson(back.items)).toBe(text);
    expect(JSON.parse(text)).toMatchObject({ app: "spuzl", kind: "drawit", version: 1 });
    expect(drawPackDiff(FAMILY_DRAW_WORDS, back.items)).toEqual({ added: [], dropped: [] });
  });

  it("reads a bare list of words, tidies case and spaces, and says what changes", () => {
    const r = parseDrawPack(JSON.stringify([" Mango ", { word: "Talking Drum", alt: ["drum"] }, "zebra"]));
    expect(r.ok && r.items).toEqual([{ word: "mango" }, { word: "talking drum", alt: ["drum"] }, { word: "zebra" }]);
    if (!r.ok) return;
    const diff = drawPackDiff(FAMILY_DRAW_WORDS, r.items);
    expect(diff.added).toEqual(["zebra"]);
    expect(diff.dropped).toContain("banku");
  });

  it("lists every problem with its word number and passes nothing", () => {
    expect(parseDrawPack("[").ok).toBe(false);
    expect(parseDrawPack(JSON.stringify({ kind: "quads", words: ["x"] })).ok).toBe(false);
    const r = parseDrawPack(JSON.stringify(["ok word", "x", "call 0244123456", "mango", "mango", { word: "kite", img: "a.png" }, "shit"]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith("Word 2:"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("Word 3:"))).toBe(true);
    expect(r.errors).toContain("Word 5: the same as word 4.");
    expect(r.errors.some((e) => e.startsWith("Word 6:"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("Word 7:") && /family-safe/.test(e))).toBe(true);
    expect(parseDrawPack(JSON.stringify(Array.from({ length: MAX_DRAW_PACK + 1 }, (_, i) => `word ${"abcdefghij"[i % 10]}`))).ok).toBe(
      false,
    );
  });
});

describe("Family Draw words in the database: one word and a pack import (round 3, item 11)", () => {
  it("checks one word like a pack entry: letters and single spaces, tidied, family-safe, distinct other names", () => {
    expect(checkDrawWord({ word: " Talking  Drum " })).toEqual({ ok: false, errors: expect.any(Array) });
    expect(checkDrawWord({ word: " Talking Drum ", alt: ["Drum"] })).toEqual({ ok: true, value: { word: "talking drum", alt: ["drum"] } });
    expect(checkDrawWord("mango")).toEqual({ ok: true, value: { word: "mango" } });
    for (const bad of ["x", "mango2", "call 0244123456", "a".repeat(31), "shit", "kite-tail"])
      expect(checkDrawWord(bad).ok, bad).toBe(false);
    expect(checkDrawWord({ word: "kite", alt: ["kite"] }).ok).toBe(false);
    expect(checkDrawWord({ word: "kite", alt: Array.from({ length: 7 }, (_, i) => `kite ${"abcdefg"[i]}`) }).ok).toBe(false);
  });

  const stored = [
    { id: "1", word: "mango", alt: [], retired_at: null },
    { id: "2", word: "kente", alt: ["kente cloth"], retired_at: null },
    { id: "3", word: "tent", alt: [], retired_at: "2026-11-08T00:00:00Z" },
    { id: "4", word: "yam", alt: [], retired_at: null },
  ];

  it("adds new words, updates other names, restores retired words, and leaves the rest alone", () => {
    const plan = planDrawImport(stored, [{ word: "mango" }, { word: "kente" }, { word: "tent" }, { word: "zebra", alt: ["horse"] }]);
    expect(plan.add).toEqual([{ word: "zebra", alt: ["horse"] }]);
    expect(plan.update).toEqual([
      { id: "2", word: "kente", alt: [], restore: false },
      { id: "3", word: "tent", alt: [], restore: true },
    ]);
    expect(plan.retire).toEqual([]);
    expect(activeAfter(stored, plan)).toBe(5);
  });

  it("retires only the active words a pack leaves out, and only when asked", () => {
    const plan = planDrawImport(stored, [{ word: "mango" }], true);
    expect(plan.retire.map((r) => r.word)).toEqual(["kente", "yam"]);
    expect(activeAfter(stored, plan)).toBe(1);
    expect(planDrawImport(stored, [{ word: "mango" }]).retire).toEqual([]);
    const same = planDrawImport(stored, [{ word: "mango" }, { word: "kente", alt: ["kente cloth"] }, { word: "yam" }], true);
    expect(same).toEqual({ add: [], update: [], retire: [] });
  });
});
