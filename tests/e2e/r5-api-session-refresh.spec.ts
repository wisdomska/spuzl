import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * The player API runs without the proxy (proxy.ts matcher): an API call carrying an expired access token refreshes
 * the session itself and sends the new cookie back, so a player who comes back after an hour is still signed in.
 */
test("an API call with an expired session refreshes it and stays signed in", async ({ page, context }) => {
  test.setTimeout(120_000);
  await onboardGuest(page);
  const me = async () => {
    const res = await context.request.get("/api/v1/me");
    return { status: res.status(), setCookie: res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").length };
  };
  expect((await me()).status).toBe(200);

  // Mark the stored session as expired (supabase-js reads `expires_at` from the cookie, then refreshes).
  const cookies = await context.cookies();
  const auth = cookies.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name));
  expect(auth.length).toBeGreaterThan(0);
  const raw = auth.map((c) => c.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString() : decodeURIComponent(raw);
  const session = JSON.parse(json) as { expires_at: number; access_token: string };
  const oldToken = session.access_token;
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.clearCookies({ name: new RegExp(`^${auth[0].name.replace(/\.\d+$/, "")}`) });
  await context.addCookies([{ ...auth[0], name: auth[0].name.replace(/\.\d+$/, ""), value }]);

  const after = await me();
  expect(after.status).toBe(200);
  expect(after.setCookie).toBeGreaterThan(0);
  const fresh = (await context.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  const freshRaw = fresh
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
  const freshSession = JSON.parse(Buffer.from(freshRaw.slice(7), "base64url").toString()) as { access_token: string; expires_at: number };
  expect(freshSession.access_token).not.toBe(oldToken);
  expect(freshSession.expires_at).toBeGreaterThan(Date.now() / 1000);
  // And the next call works with the new cookie.
  expect((await me()).status).toBe(200);
});
