import { describe, expect, it } from "vitest";
import { isTestAccount } from "../../scripts/qa/test-account.mjs";

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
