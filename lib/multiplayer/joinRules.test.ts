import { describe, expect, it } from "vitest";
import { hostIsUnder16, joinAccess, type JoinFacts } from "./joinRules";

const base: JoinFacts = { friendsOnly: true, isHost: false, wasMember: false, friends: false, blocked: false, approved: false };
const today = new Date(Date.UTC(2026, 10, 6));

describe("joinAccess (R2-13 friends-only rooms)", () => {
  it("lets a non-friend in only after the host approves", () => {
    expect(joinAccess(base)).toBe("ask");
    expect(joinAccess({ ...base, approved: true })).toBe("join");
  });
  it("lets the host's accepted friends straight in", () => {
    expect(joinAccess({ ...base, friends: true })).toBe("join");
  });
  it("never lets in a blocked pair, even with an old approval or friendship", () => {
    expect(joinAccess({ ...base, blocked: true, approved: true })).toBe("ask");
    expect(joinAccess({ ...base, blocked: true, friends: true })).toBe("ask");
  });
  it("leaves rooms that are not friends only open, and the host and earlier members alone", () => {
    expect(joinAccess({ ...base, friendsOnly: false })).toBe("join");
    expect(joinAccess({ ...base, isHost: true })).toBe("join");
    expect(joinAccess({ ...base, wasMember: true })).toBe("join");
  });
});

describe("hostIsUnder16", () => {
  it("reads the effective band, and treats an unknown band as under 16", () => {
    expect(hostIsUnder16({ age_band: "13-15" }, today)).toBe(true);
    expect(hostIsUnder16({ age_band: "16-17" }, today)).toBe(false);
    expect(hostIsUnder16({ age_band: "18+", birth_year: 2011, birth_month: 1 }, today)).toBe(true);
    expect(hostIsUnder16({}, today)).toBe(true);
  });
});
