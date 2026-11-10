import { describe, expect, it } from "vitest";
import { freeCard, SAMPLE_CARDS, worldCardColours } from "./card-model";
import { freeShareText, SHARE_DOMAIN } from "./text";
import { cardUrl } from "./urls";

describe("free-play clear card (R4-20)", () => {
  const base = {
    world: "number" as const,
    gameName: "Nine",
    scoring: "time" as const,
    timeMs: 95_000,
    score: null,
    hints: 0,
    deaths: 0,
    streak: 3,
    level: 7,
  };

  it("draws like the Daily card in the game's colours, with Free play in place of the number", () => {
    const c = freeCard(base);
    expect(c.kind).toBe("free");
    expect(c.kicker).toBe("Nine · Free play");
    expect(c.big).toBe("1:35");
    expect(c.line).toBe("No hints.");
    expect(c.bg).toBe(worldCardColours("number").bg);
    expect(c.foot).toContain("Lv 7");
    expect(c.alt).toMatch(/free play, cleared in 1:35/);
    expect(c.kicker).not.toMatch(/#/);
  });

  it("shows a score game's score and never a comparison", () => {
    const c = freeCard({ ...base, gameName: "Quickfire", scoring: "score", score: 1200, hints: 2 });
    expect(c.big).toBe("1,200");
    expect(c.line).toBe("2 hints.");
    expect(c.line).not.toMatch(/Faster|Fastest/);
    expect(c.alt).toMatch(/1,200 points/);
  });

  it("has a sample frame and its own image route", () => {
    expect(SAMPLE_CARDS.free.kind).toBe("free");
    expect(cardUrl("free", "abc")).toBe("/api/og/free/abc");
    expect(cardUrl("free", "abc", { format: "square" })).toBe("/api/og/free/abc?format=square");
  });

  it("share text has no Daily number", () => {
    const t = freeShareText({ gameId: "crownfall", timeMs: 72_000, hints: 1, streak: 4 });
    const [head, ...rest] = t.split("\n");
    expect(head).toBe("SPUZL · Crownfall · Free play · 1:12 🔥4");
    expect(rest.at(-1)).toBe(SHARE_DOMAIN);
    expect(t).not.toMatch(/#\d/);
  });
});
