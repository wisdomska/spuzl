import { describe, expect, it } from "vitest";
import { GAMES } from "@/lib/catalog";
import { FEATURES, SITE_FAQ, seoMeta } from "@/lib/copy/seo";
import { BAY_GAMES } from "@/lib/multiplayer/bay";
import { PARTY_MAX } from "@/lib/multiplayer/constants";
import { gameFacts } from "./games";
import { llmsFullTxt } from "./llms";
import { videoGame, webApplication } from "./jsonld";

/** Owner, 12 Nov 2026: SEO and GEO carry everything shipped since 1.42.0. */
describe("SEO and GEO refresh (R6)", () => {
  it("the FAQ answers Daily Five, playing with friends at today's party size, and accessibility", () => {
    const qs = SITE_FAQ.map((x) => x.q);
    expect(qs).toContain("What is the Daily Five?");
    expect(qs).toContain("Can I play with a keyboard or a screen reader?");
    const friends = SITE_FAQ.find((x) => x.q === "Can I play with friends?")!.a;
    expect(friends).toContain(`up to ${PARTY_MAX} players`);
    expect(friends).toMatch(/Board Bay/);
    expect(friends).toMatch(/challenge link/);
  });

  it("llms-full.txt lists every feature", () => {
    const txt = llmsFullTxt();
    expect(txt).toContain("## Features");
    for (const f of FEATURES) expect(txt).toContain(`- ${f}`);
    expect(txt).toMatch(/Daily Five/);
    expect(txt).toMatch(/Ghost Races/);
  });

  it("the app's structured data carries the feature list and accessibility", () => {
    const app = webApplication() as Record<string, unknown>;
    expect(app.featureList).toEqual([...FEATURES]);
    expect(app.accessibilityFeature).toContain("keyboardNavigation");
  });

  it("party games say how many can play; solo games don't", () => {
    const withParty = GAMES.find((g) => gameFacts(g).modes.includes("party"))!;
    expect((videoGame(gameFacts(withParty)) as { numberOfPlayers: { maxValue: number } }).numberOfPlayers.maxValue).toBe(PARTY_MAX);
    const solo = GAMES.find((g) => gameFacts(g).modes.every((m) => m === "free" || m === "levels"));
    if (solo) expect((videoGame(gameFacts(solo)) as Record<string, unknown>).numberOfPlayers).toBeUndefined();
  });

  it("Board Bay copy names only Board Bay games", () => {
    const bay = FEATURES.find((f) => f.startsWith("Board Bay"))!;
    expect(BAY_GAMES).not.toContain("dara");
    expect(bay).not.toMatch(/dara/i);
  });

  it("descriptions stay under 155 characters", () => {
    expect(seoMeta.landing.description.length).toBeLessThanOrEqual(155);
    expect(seoMeta.landing.description).toContain(`party of ${PARTY_MAX}`);
  });
});
