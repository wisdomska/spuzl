import { describe, expect, it } from "vitest";
import { adultPartyRefusal, canSeeAdultParty } from "./gate";
import { isAdultMode, leadFor, roundsFor } from "./modes";

const adult = { ageBand: "18+", guest: false };

describe("18+ party age gate", () => {
  it("lets signed-in adults in only while the admin switch is on", () => {
    expect(adultPartyRefusal(adult, true)).toBeNull();
    expect(adultPartyRefusal(adult, false)).toBe("adult_party_off");
  });
  it("refuses guests, then anyone under 18", () => {
    expect(adultPartyRefusal({ ...adult, guest: true }, true)).toBe("adults_signed_in");
    expect(adultPartyRefusal({ ageBand: "16-17", guest: false }, true)).toBe("adults_only");
    expect(adultPartyRefusal({ ageBand: "13-15", guest: false }, true)).toBe("adults_only");
    expect(adultPartyRefusal({ ageBand: null, guest: false }, true)).toBe("adults_only");
    // The switch is checked first, so nobody learns more than "off".
    expect(adultPartyRefusal({ ageBand: "13-15", guest: true }, false)).toBe("adult_party_off");
  });
  it("refuses a player under a moderator block until it runs out", () => {
    const now = Date.parse("2026-11-12T12:00:00Z");
    expect(adultPartyRefusal({ ...adult, blockedUntil: "2026-11-13T00:00:00Z" }, true, now)).toBe("adult_party_blocked");
    expect(adultPartyRefusal({ ...adult, blockedUntil: "2026-11-12T11:59:59Z" }, true, now)).toBeNull();
  });
  it("hides the modes on the client unless the same rule passes", () => {
    expect(canSeeAdultParty({ age_band: "18+", guest: false }, true)).toBe(true);
    expect(canSeeAdultParty({ age_band: "18+", guest: false }, false)).toBe(false);
    expect(canSeeAdultParty({ age_band: "18+", guest: true }, true)).toBe(false);
    expect(canSeeAdultParty({ age_band: "18+" }, true)).toBe(false); // unknown guest flag: hidden
    expect(canSeeAdultParty({ age_band: "16-17", guest: false }, true)).toBe(false);
    expect(canSeeAdultParty(null, true)).toBe(false);
  });
});

describe("party modes", () => {
  it("knows which modes are adults only", () => {
    expect(isAdultMode("draw")).toBe(true);
    expect(isAdultMode("truths")).toBe(true);
    expect(isAdultMode("race")).toBe(false);
    expect(isAdultMode(undefined)).toBe(false);
  });
  it("gives everyone one turn to lead, up to 8", () => {
    expect(roundsFor(3)).toBe(3);
    expect(roundsFor(12)).toBe(8);
    expect(leadFor(["a", "b"], 2)).toBe("b");
    expect(leadFor(["a", "b"], 3)).toBeNull();
  });
});
