import { describe, expect, it } from "vitest";
import { CONTENT } from "@/games/twotruths/content";
import { validatePayload } from "./content-schemas";
import { MAX_TRUTHS_PACK, parseTruthsPack, truthsPackToJson } from "./truths-pack";

describe("Two Truths packs (admin import and export, R2-P5)", () => {
  it("every shipped round passes the editor's schema", () => {
    for (const r of CONTENT) expect(validatePayload("twotruths", r).success, r.id).toBe(true);
  });

  it("round-trips the whole bank: export, import, export gives the same file", () => {
    const text = truthsPackToJson(CONTENT);
    const back = parseTruthsPack(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.items).toEqual(CONTENT);
    expect(truthsPackToJson(back.items)).toBe(text);
    expect(JSON.parse(text)).toMatchObject({ app: "spuzl", kind: "twotruths", version: 1 });
  });

  it("reads a bare list and trims stray spaces", () => {
    const loose = { ...CONTENT[0], lie: `  ${CONTENT[0].lie} ` };
    const r = parseTruthsPack(JSON.stringify([loose, CONTENT[1]]));
    expect(r.ok && r.items).toEqual([CONTENT[0], CONTENT[1]]);
  });

  it("lists every problem with its round number and saves nothing", () => {
    expect(parseTruthsPack("{")).toEqual({ ok: false, errors: ["Not valid JSON."] });
    expect(parseTruthsPack(JSON.stringify({ kind: "quads", puzzles: [] })).ok).toBe(false);
    expect(parseTruthsPack(JSON.stringify([])).ok).toBe(false);
    const bad = [
      { ...CONTENT[0], theme: "politics" },
      CONTENT[1],
      { ...CONTENT[2], lie: CONTENT[2].truths[0] },
      { ...CONTENT[3], fix: "No – dashes" },
      { ...CONTENT[4], source: "" },
      CONTENT[1],
    ];
    const r = parseTruthsPack(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.startsWith("Round 1: theme"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("Round 3: lie"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("Round 4: fix"))).toBe(true);
    expect(r.errors.some((e) => e.startsWith("Round 5: source"))).toBe(true);
    expect(r.errors).toContain("Round 6: the same as round 2.");
    const many = Array.from({ length: MAX_TRUTHS_PACK + 1 }, (_, i) => ({ ...CONTENT[0], id: `r-${i}` }));
    expect(parseTruthsPack(JSON.stringify(many)).ok).toBe(false);
  });
});
