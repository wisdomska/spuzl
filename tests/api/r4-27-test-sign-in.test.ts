import { describe, expect, it } from "vitest";
import { BASE, admin, uniq } from "./helpers";

/**
 * R4-27: the test-only sign-in route. With the server started with ENABLE_DEV_ROUTES=1 (and not a production
 * deployment) it signs a `.test` address in with no email and sets the auth cookies; otherwise it answers 404.
 * Real addresses are refused either way. lib/dev/guard.ts holds the switch (unit tested in
 * tests/unit/dev-sign-in-guard.test.ts).
 * Run: API_BASE=http://localhost:3000 pnpm vitest run -c vitest.api.config.mts tests/api/r4-27-test-sign-in.test.ts
 */
const post = (json: unknown) =>
  fetch(`${BASE}/api/dev/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) });

describe("api: test sign-in (R4-27)", () => {
  it("signs a .test account in with auth cookies when enabled, and is not found otherwise", async () => {
    const email = `${uniq("ts")}@signin.test`;
    const res = await post({ email });
    if (process.env.ENABLE_DEV_ROUTES !== "1") {
      expect([404, 200]).toContain(res.status);
      if (res.status === 404) return;
    }
    expect(res.status, await res.clone().text()).toBe(200);
    const { userId } = (await res.json()) as { userId: string };
    expect(res.headers.get("set-cookie") ?? "").toMatch(/sb-.*auth-token/);
    const { data } = await admin().auth.admin.getUserById(userId);
    expect(data.user?.email).toBe(email);
    await admin().auth.admin.deleteUser(userId);
  });

  it("never signs in a real address", async () => {
    const res = await post({ email: "someone@gmail.com" });
    expect([400, 404]).toContain(res.status);
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/auth-token/);
  });
});
