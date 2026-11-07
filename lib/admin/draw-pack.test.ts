import { describe, expect, it } from "vitest";
import { FAMILY_DRAW_WORDS } from "@/lib/party-adult/family";
import { drawPackDiff, drawPackToJson, MAX_DRAW_PACK, parseDrawPack } from "./draw-pack";

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
