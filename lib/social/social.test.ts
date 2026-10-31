import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  agoLong,
  agoShort,
  canRequestByUsername,
  feedLine,
  initial,
  isUnder16,
  makeCode,
  normaliseCode,
  presenceFor,
  REACTIONS,
  REACTION_GLYPH,
} from "./index";

describe("codes", () => {
  it("never uses 0, O, 1 or I", () => {
    expect(CODE_ALPHABET).not.toMatch(/[0O1I]/);
    let seed = 0;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 200; i++) expect(makeCode(6, rnd)).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
  });
  it("normalises typed codes", () => {
    expect(normaliseCode(" k7q-x ")).toBe("K7QX");
  });
});

describe("presence", () => {
  const now = Date.parse("2026-10-31T12:00:00Z");
  it("is online within two minutes, with the game being played", () => {
    expect(presenceFor("2026-10-31T11:59:00Z", "crownfall", now)).toEqual({ online: true, label: "Playing Crownfall" });
    expect(presenceFor("2026-10-31T11:59:00Z", null, now)).toEqual({ online: true, label: "Online" });
  });
  it("shows when they were last seen", () => {
    expect(presenceFor("2026-10-31T10:00:00Z", "crownfall", now)).toEqual({ online: false, label: "Seen 2 h ago" });
    expect(presenceFor(null, null, now)).toEqual({ online: false, label: "Offline" });
  });
  it("formats ages", () => {
    expect(agoLong(30_000)).toBe("1 min");
    expect(agoLong(3 * 86_400_000)).toBe("3 d");
    expect(agoShort("2026-10-31T11:56:00Z", now)).toBe("4m");
    expect(agoShort("2026-10-31T11:00:00Z", now)).toBe("1h");
    expect(agoShort("2026-10-29T11:00:00Z", now)).toBe("2d");
    expect(agoShort("2026-10-31T12:00:00Z", now)).toBe("now");
  });
});

describe("safety rules", () => {
  it("blocks username requests to or from under-16s", () => {
    expect(isUnder16("13-15")).toBe(true);
    expect(canRequestByUsername("18+", "16-17")).toBe(true);
    expect(canRequestByUsername("13-15", "18+")).toBe(false);
    expect(canRequestByUsername("18+", "13-15")).toBe(false);
  });
  it("only has preset reactions", () => {
    expect(REACTIONS).toEqual(["fire", "lol", "gg", "wow", "clap"]);
    expect(Object.keys(REACTION_GLYPH)).toHaveLength(5);
  });
});

describe("feed copy", () => {
  it("matches the design line and never uses dashes", () => {
    expect(feedLine("Kofi", "clear", "crownfall", { timeMs: 65_000, hints: 0 })).toBe("Kofi cleared Crownfall in 1:05, no hints");
    expect(feedLine("Zainab", "streak", null, { days: 30 })).toBe("Zainab hit a 30-day streak");
    expect(feedLine("Ama", "full_spuzl", "dusk", { timeMs: 1000, hints: 1 })).toBe("Ama cleared Dusk in 0:01. Full Spuzl today");
    expect(feedLine("Ama", "badge", null, { badge: "x" }, () => "Night Owl")).toBe("Ama earned Night Owl");
    expect(feedLine("Ama", "level", null, { level: 10 })).toBe("Ama reached level 10");
    expect(feedLine("Ama", "promotion", null, { tier: "Gold Crown" })).toBe("Ama was promoted to Gold Crown");
    expect(feedLine("Ama", "duel_win", null, {})).toBe("Ama won a Duel");
    expect(feedLine("Ama", "party_win", null, {})).toBe("Ama won a Party Race");
    expect(feedLine("Ama", "other", null, {})).toBe("Ama played SPUZL");
    for (const k of ["clear", "badge", "level", "streak", "promotion"]) expect(feedLine("A", k, "crownfall", {})).not.toMatch(/[–—]/);
  });
  it("takes the first letter for avatar chips", () => {
    expect(initial("ama")).toBe("A");
    expect(initial(" ")).toBe("?");
  });
});
