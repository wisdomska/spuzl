import { describe, expect, it } from "vitest";
import { TEST_EMAIL, testSignInAllowed } from "@/lib/dev/guard";

describe("test sign-in guard (R4-27)", () => {
  it("is off unless ENABLE_DEV_ROUTES is 1, development included", () => {
    expect(testSignInAllowed({ NODE_ENV: "development" })).toBe(false);
    expect(testSignInAllowed({ NODE_ENV: "development", ENABLE_DEV_ROUTES: "true" })).toBe(false);
    expect(testSignInAllowed({ NODE_ENV: "development", ENABLE_DEV_ROUTES: "1" })).toBe(true);
    expect(testSignInAllowed({ NODE_ENV: "test", ENABLE_DEV_ROUTES: "1" })).toBe(true);
  });

  it("can never be switched on in a Vercel production deployment", () => {
    for (const extra of [{}, { ALLOW_TEST_SIGN_IN: "1" }])
      expect(testSignInAllowed({ NODE_ENV: "production", VERCEL_ENV: "production", ENABLE_DEV_ROUTES: "1", ...extra })).toBe(false);
    expect(testSignInAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview", ENABLE_DEV_ROUTES: "1" })).toBe(true);
  });

  it("a production build outside Vercel also needs ALLOW_TEST_SIGN_IN", () => {
    expect(testSignInAllowed({ NODE_ENV: "production", ENABLE_DEV_ROUTES: "1" })).toBe(false);
    expect(testSignInAllowed({ NODE_ENV: "production", ENABLE_DEV_ROUTES: "1", ALLOW_TEST_SIGN_IN: "1" })).toBe(true);
  });

  it("only signs in addresses on the reserved .test domain", () => {
    expect(TEST_EMAIL.test("fam123@family.test")).toBe(true);
    expect(TEST_EMAIL.test("a.b+c@x.y.test")).toBe(true);
    for (const real of ["player@gmail.com", "x@family.test.com", "x@test", "x@family.testing", "a@b.test\n"])
      expect(TEST_EMAIL.test(real), real).toBe(false);
  });
});
