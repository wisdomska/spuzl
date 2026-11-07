import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
import { COPY_MAX, DEFAULT_META, filterGames, gameCopy, validateCopyLine, validateMeta } from "./index";
import { mergeMeta } from "./server";
import { GAMES, GAME_BY_ID, LAB_GAMES } from "@/lib/catalog";

describe("per-game rule and card copy overrides (R2-ADMIN)", () => {
  it("every catalog rule and blurb would pass the admin check, so a reset value is always valid", () => {
    for (const g of [...GAMES, ...LAB_GAMES]) {
      expect(validateCopyLine(g.rule, "rule"), g.id).toBeNull();
      expect(validateCopyLine(g.blurb, "blurb"), g.id).toBeNull();
    }
  });

  it("accepts one line up to 130 characters and refuses the rest", () => {
    expect(COPY_MAX).toBe(130);
    expect(validateCopyLine("a".repeat(130), "The rule")).toBeNull();
    expect(validateCopyLine("a".repeat(131), "The rule")).toMatch(/at most 130 characters \(now 131\)/);
    expect(validateCopyLine("two\nlines", "The rule")).toMatch(/one line/);
    expect(validateCopyLine("two\rlines", "The rule")).toMatch(/one line/);
    expect(validateCopyLine("   ", "The rule")).toMatch(/cannot be empty/);
    expect(validateCopyLine(" padded", "The rule")).toMatch(/spaces/);
    expect(validateCopyLine(42, "The rule")).toMatch(/must be text/);
    expect(validateMeta({ rule: "Fill the grid.", blurb: "Quick and calm." })).toBeNull();
    expect(validateMeta({ blurb: "x".repeat(200) })).toMatch(/card copy must be at most 130/);
    expect(validateMeta({ rule: "" })).toMatch(/rule cannot be empty/);
  });

  it("uses the override where there is one and the catalog's copy otherwise", () => {
    const crown = GAME_BY_ID.crownfall;
    expect(gameCopy(crown, DEFAULT_META)).toEqual({ rule: crown.rule, blurb: crown.blurb });
    const meta = { ...DEFAULT_META, crownfall: { ...DEFAULT_META.crownfall, rule: "One crown per row, column and colour." } };
    expect(gameCopy(crown, meta)).toEqual({ rule: "One crown per row, column and colour.", blurb: crown.blurb });
    expect(gameCopy(crown, { ...meta, crownfall: { ...meta.crownfall, blurb: "Royal logic." } }).blurb).toBe("Royal logic.");
  });

  it("merges stored overrides and drops copy that is no longer one valid line", () => {
    const m = mergeMeta([
      { id: "crownfall", typical_sec: null, tags: null, rule: "Crowns everywhere.", blurb: null },
      { id: "dusk", typical_sec: 90, tags: ["quick"], rule: "bad\nrule", blurb: "x".repeat(131) },
      { id: "nine", typical_sec: null, tags: null }, // before 20261202000101: no copy columns
      { id: "no-such-game", typical_sec: 10, tags: null, rule: "ignored", blurb: null },
    ]);
    expect(m.crownfall.rule).toBe("Crowns everywhere.");
    expect(m.crownfall.blurb).toBeUndefined();
    expect(m.dusk).toMatchObject({ typicalSec: 90, tags: ["quick"] });
    expect(m.dusk.rule).toBeUndefined();
    expect(m.dusk.blurb).toBeUndefined();
    expect(m.nine).toEqual(DEFAULT_META.nine);
    expect(m["no-such-game"]).toBeUndefined();
  });

  it("Library search matches the overridden card copy", () => {
    const meta = { ...DEFAULT_META, crownfall: { ...DEFAULT_META.crownfall, blurb: "Zebracorn regal logic" } };
    expect(filterGames(GAMES, "all", "zebracorn", meta).map((g) => g.id)).toEqual(["crownfall"]);
    expect(filterGames(GAMES, "all", "zebracorn", DEFAULT_META)).toEqual([]);
  });
});
