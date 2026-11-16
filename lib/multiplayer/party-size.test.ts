import { describe, expect, it } from "vitest";
import { PARTY_DEFAULT, PARTY_MAX, PARTY_MIN, TIMING, partyMaxFor, progressMsFor, roomLimit } from "./constants";
import { RoomCreateInput } from "./roomInput";
import { DEFAULTS, SETTINGS, validateSetting } from "@/lib/game-settings/schema";

/** Owner, 16 Nov 2026: Party rooms hold up to 8 (was 10); the admin sets the limit (party.maxPlayers). */
describe("party size", () => {
  it("allows 2 to 8, hosts start at 8", () => {
    expect([PARTY_MIN, PARTY_DEFAULT, PARTY_MAX]).toEqual([2, 8, 8]);
    expect(RoomCreateInput.parse({ game: "crownfall", difficulty: "easy" }).maxPlayers).toBe(8);
    expect(RoomCreateInput.parse({ game: "crownfall", difficulty: "easy", maxPlayers: 8 }).maxPlayers).toBe(8);
    expect(() => RoomCreateInput.parse({ game: "crownfall", difficulty: "easy", maxPlayers: 9 })).toThrow();
    expect(() => RoomCreateInput.parse({ game: "crownfall", difficulty: "easy", maxPlayers: 1 })).toThrow();
  });

  it("reads the admin limit, falling back to the ceiling on a bad value", () => {
    expect(DEFAULTS["party.maxPlayers"]).toBe(8);
    expect(partyMaxFor(6)).toBe(6);
    expect(partyMaxFor(8)).toBe(8);
    // A stored 10 from before the limit came down plays as 8.
    for (const bad of [1, 9, 10, 7.5, "8", null, undefined]) expect(partyMaxFor(bad)).toBe(PARTY_MAX);
    expect(validateSetting("party.maxPlayers", 2)).toBeNull();
    expect(validateSetting("party.maxPlayers", 8)).toBeNull();
    expect(validateSetting("party.maxPlayers", 9)).toMatch(/between 2 and 8/);
    expect(SETTINGS["party.maxPlayers"].help.length).toBeGreaterThan(20);
  });

  it("halves the progress rate in rooms of 7 or more", () => {
    expect(progressMsFor(2)).toBe(TIMING.progressMs);
    expect(progressMsFor(6)).toBe(TIMING.progressMs);
    expect(progressMsFor(7)).toBe(TIMING.progressMs * 2);
    expect(progressMsFor(8)).toBe(1000);
  });

  it("caps turn games (Draw It, Two Truths) at their own limit, never above the Party limit", () => {
    expect(DEFAULTS["party.maxPlayersTurns"]).toBe(8);
    expect(roomLimit(8, 8, false)).toBe(8);
    expect(roomLimit(8, 6, true)).toBe(6);
    expect(roomLimit(6, 8, true)).toBe(6);
    expect(roomLimit(8, 4, true)).toBe(4);
    expect(roomLimit(8, 99, true)).toBe(8);
    expect(validateSetting("party.maxPlayersTurns", 9)).toMatch(/between 2 and 8/);
  });
});
