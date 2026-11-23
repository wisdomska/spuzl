import { describe, expect, it } from "vitest";
import { isTestAccount, pickStale } from "../../scripts/qa/test-account.mjs";

/** Owner, 17 Nov 2026: "always clear test accounts, whether admin or user, after using them". */
describe("isTestAccount", () => {
  it("accepts anonymous guests and reserved .test addresses", () => {
    expect(isTestAccount({ is_anonymous: true, email: null })).toBe(true);
    expect(isTestAccount({ is_anonymous: true, email: "" })).toBe(true);
    expect(isTestAccount({ is_anonymous: false, email: "owner_ab12@admin.test" })).toBe(true);
    expect(isTestAccount({ email: "owner@ci.spuzl.test" })).toBe(true);
  });

  it("never accepts a real account", () => {
    expect(isTestAccount({ is_anonymous: false, email: "player@gmail.com" })).toBe(false);
    expect(isTestAccount({ is_anonymous: true, email: "player@gmail.com" })).toBe(false);
    expect(isTestAccount({ is_anonymous: false, email: null })).toBe(false);
    expect(isTestAccount({ email: "someone@test.com" })).toBe(false);
    expect(isTestAccount({ email: "a@admin.test.example.com" })).toBe(false);
  });
});

describe("pickStale (sweep-test-accounts.mjs)", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  const cutoff = now - 6 * 3600_000;
  const at = (h: number) => new Date(now - h * 3600_000).toISOString();
  it("takes old test accounts only: a run in progress and real players keep theirs", () => {
    const users = [
      { id: "old-guest", is_anonymous: true, email: null, created_at: at(30) },
      { id: "old-admin", email: "a1@admin.test", created_at: at(7) },
      { id: "new-guest", is_anonymous: true, email: null, created_at: at(1) },
      { id: "real", email: "player@gmail.com", created_at: at(500) },
      { id: "no-date", is_anonymous: true, email: null },
    ];
    expect(pickStale(users, cutoff).map((u) => u.id)).toEqual(["old-guest", "old-admin"]);
  });
});
