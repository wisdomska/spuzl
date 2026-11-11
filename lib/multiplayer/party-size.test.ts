import { describe, expect, it } from "vitest";
import { PARTY_DEFAULT, PARTY_MAX, PARTY_MIN, TIMING, partyMaxFor, progressMsFor } from "./constants";
import { RoomCreateInput } from "./roomInput";
import { DEFAULTS, SETTINGS, validateSetting } from "@/lib/game-settings/schema";

/** Owner, 11 Nov 2026: Party rooms hold up to 10; the admin sets the limit (party.maxPlayers). */
describe("party size", () => {
  it("allows 2 to 10, hosts start at 8", () => {
    expect([PARTY_MIN, PARTY_DEFAULT, PARTY_MAX]).toEqual([2, 8, 10]);
    expect(RoomCreateInput.parse({ game: "crownfall", difficulty: "easy" }).maxPlayers).toBe(8);
    expect(RoomCreateInput.parse({ game: "crownfall", difficulty: "easy", maxPlayers: 10 }).maxPlayers).toBe(10);
    expect(() => RoomCreateInput.parse({ game: "crownfall", difficulty: "easy", maxPlayers: 11 })).toThrow();
    expect(() => RoomCreateInput.parse({ game: "crownfall", difficulty: "easy", maxPlayers: 1 })).toThrow();
  });

  it("reads the admin limit, falling back to the ceiling on a bad value", () => {
    expect(DEFAULTS["party.maxPlayers"]).toBe(10);
    expect(partyMaxFor(6)).toBe(6);
    expect(partyMaxFor(10)).toBe(10);
    for (const bad of [1, 11, 7.5, "8", null, undefined]) expect(partyMaxFor(bad)).toBe(PARTY_MAX);
    expect(validateSetting("party.maxPlayers", 2)).toBeNull();
    expect(validateSetting("party.maxPlayers", 10)).toBeNull();
    expect(validateSetting("party.maxPlayers", 11)).toMatch(/between 2 and 10/);
    expect(SETTINGS["party.maxPlayers"].help.length).toBeGreaterThan(20);
  });

  it("halves the progress rate in rooms of 7 or more", () => {
    expect(progressMsFor(2)).toBe(TIMING.progressMs);
    expect(progressMsFor(6)).toBe(TIMING.progressMs);
    expect(progressMsFor(7)).toBe(TIMING.progressMs * 2);
    expect(progressMsFor(10)).toBe(1000);
  });
});
