import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DEFAULTS, SETTINGS, validateSetting } from "@/lib/game-settings/schema";
import { PARTY_REWARD_SOURCE, partyXp } from "@/lib/multiplayer/server/rewards";

describe("Party Race XP (R4-25)", () => {
  it("reads the winner and player XP from the settings, never below zero", () => {
    const s = { "party.winXp": 45, "party.playXp": 12 };
    expect(partyXp(true, s)).toBe(45);
    expect(partyXp(false, s)).toBe(12);
    expect(partyXp(false, { "party.winXp": 0, "party.playXp": -5 })).toBe(0);
  });

  it("has admin settings with sensible defaults and a daily cap, on its own ledger source", () => {
    expect(DEFAULTS["party.winXp"]).toBe(30);
    expect(DEFAULTS["party.playXp"]).toBe(10);
    expect(DEFAULTS["party.xpDailyCap"]).toBe(150);
    expect(SETTINGS["party.xpDailyCap"]).toMatchObject({ kind: "int", min: 0, max: 2000 });
    expect(validateSetting("party.xpDailyCap", 5000)).not.toBeNull();
    expect(validateSetting("party.xpDailyCap", 0)).toBeNull();
    expect(PARTY_REWARD_SOURCE).toBe("party");
  });
});
