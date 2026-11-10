import { describe, expect, it } from "vitest";
import { hostIsUnder16, joinAccess, receivedForExport, type JoinFacts } from "./joinRules";

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

describe("receivedForExport (R4-X data export)", () => {
  it("keeps only the asker's nickname, the room, the time and the outcome", () => {
    const rows = [
      { requester_id: "a", room_kind: "party", room_code: "ABCD", created_at: "2026-11-10T10:00:00Z", status: "approved" },
      { requester_id: "gone", room_kind: "duel", room_code: "WXYZ", created_at: "2026-11-10T11:00:00Z", status: "pending" },
    ];
    const out = receivedForExport(rows, new Map([["a", "Kofi"]]));
    expect(out).toEqual([
      { requester_nickname: "Kofi", room_kind: "party", room_code: "ABCD", requested_at: "2026-11-10T10:00:00Z", status: "approved" },
      { requester_nickname: null, room_kind: "duel", room_code: "WXYZ", requested_at: "2026-11-10T11:00:00Z", status: "pending" },
    ]);
    expect(JSON.stringify(out)).not.toContain('"a"');
  });
});
