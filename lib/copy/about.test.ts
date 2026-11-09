import { describe, expect, it } from "vitest";
import { aboutCopy } from "./about";

const S = aboutCopy.spil;

describe("about copy: SPIL sister app card (R4-01)", () => {
  it("mirrors SPIL's own section: eyebrow, name, hero line and an https link", () => {
    expect(S.eyebrow).toBe("Also by Senya");
    expect(S.name).toBe("SPIL");
    expect(S.tagline).toBe("Your friends think they know you. Prove it.");
    expect(S.url).toBe("https://spil-party.vercel.app");
    expect(S.cta).toBe("Play SPIL");
    expect(S.note).toBe("No app, no signup.");
  });

  it("carries only the facts from SPIL's launch copy: three stats and four features", () => {
    expect(S.stats.map((s) => s.join(" "))).toEqual(["10 party games", "Up to 12 players", "Free to play"]);
    expect(S.features).toHaveLength(4);
    expect(S.features[0][0]).toBe("Spill Score");
    expect(S.features.some(([, body]) => body.includes("18+ packs only show when everyone in the room is 18 or older"))).toBe(true);
  });

  it("keeps the old strip copy gone and the footer credit in place", () => {
    expect(JSON.stringify(S)).not.toContain("Prefer card and party games?");
    expect(aboutCopy.credit).toBe("Designed & Developed by Senya");
    expect(aboutCopy.creditUrl).toBe("https://wisdomska.site");
  });
});
