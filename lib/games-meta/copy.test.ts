import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
import { COPY_MAX, DEFAULT_META, filterGames, gameCopy, validateCopyLine, validateMeta } from "./index";
import { mergeMeta, withCopy } from "./server";
import { llmsFullTxt, llmsTxt } from "@/lib/seo/llms";
import { gameDescription, gameFacts } from "@/lib/seo/games";
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

  it("leaves a screen's own copy alone (the bot screen's full-game rule)", () => {
    const chess = GAME_BY_ID.chess;
    const meta = { ...DEFAULT_META, chess: { ...DEFAULT_META.chess, rule: "Checkmate the king." } };
    expect(gameCopy(chess, meta).rule).toBe("Checkmate the king.");
    expect(gameCopy({ ...chess, rule: "Play a full game against the bot." }, meta).rule).toBe("Play a full game against the bot.");
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

describe("Daily Five typical score (owner decision S)", () => {
  it("has a valid default for the main score games and none for games scored on time", () => {
    for (const id of ["quickfire", "echo"]) expect(DEFAULT_META[id].typicalScore, id).toBeGreaterThan(0);
    // The score games that graduated from the lab (11 Nov 2026) each have one too.
    for (const id of ["hilo", "pinned", "flagged", "twotruths"]) expect(DEFAULT_META[id].typicalScore, id).toBeGreaterThan(0);
    for (const [id, m] of Object.entries(DEFAULT_META)) {
      if (m.typicalScore !== undefined) expect(GAME_BY_ID[id].scoring, id).toBe("score");
      expect(validateMeta({ typicalScore: m.typicalScore }), id).toBeNull();
    }
    expect(DEFAULT_META.crownfall.typicalScore).toBeUndefined();
  });

  it("validates an override and merges it for score games only", () => {
    expect(validateMeta({ typicalScore: 0 })).toMatch(/whole number between 1/);
    expect(validateMeta({ typicalScore: 2.5 })).toMatch(/whole number/);
    expect(validateMeta({ typicalScore: 450 })).toBeNull();
    const m = mergeMeta([
      { id: "quickfire", typical_sec: null, tags: null, typical_score: 500 },
      { id: "crownfall", typical_sec: null, tags: null, typical_score: 500 },
      { id: "echo", typical_sec: null, tags: null, typical_score: null },
    ]);
    expect(m.quickfire.typicalScore).toBe(500);
    expect(m.crownfall.typicalScore).toBeUndefined();
    expect(m.echo.typicalScore).toBe(DEFAULT_META.echo.typicalScore);
  });
});

describe("admin copy on server-built copy (R4-10)", () => {
  const RULE = "Crowns in every row, column and colour, never touching.";
  const meta = { ...DEFAULT_META, crownfall: { ...DEFAULT_META.crownfall, rule: RULE, blurb: "Regal logic" } };
  const copy = <T extends { id: string; rule: string; blurb: string }>(g: T) => withCopy(g, meta);

  it("puts the override on the game and leaves others as they are", () => {
    const g = withCopy(GAME_BY_ID.crownfall, meta);
    expect(g.rule).toBe(RULE);
    expect(g.blurb).toBe("Regal logic");
    expect(g.name).toBe(GAME_BY_ID.crownfall.name);
    expect(withCopy(GAME_BY_ID.dusk, meta)).toBe(GAME_BY_ID.dusk);
  });

  it("reaches the public game page facts and llms.txt / llms-full.txt", () => {
    const g = copy(GAME_BY_ID.crownfall);
    expect(gameFacts(g).definition + gameDescription(g)).toContain("never touching");
    expect(llmsFullTxt(copy)).toContain(`- Rule: ${RULE}`);
    expect(llmsFullTxt()).not.toContain(RULE);
    expect(llmsTxt(copy)).not.toBe(llmsTxt());
  });
});
