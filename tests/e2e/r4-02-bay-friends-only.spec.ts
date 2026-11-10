import { expect, test, type Page } from "@playwright/test";
import { guestContext } from "./harness";

/**
 * R4-02: a Board Bay invite from a 13 to 15 host is friends only (setting "rooms.under16FriendsOnly", on by
 * default). A stranger who opens the link and taps Join is told to become friends first and is not seated; a
 * 16+ host's invite still lets them in. tests/api/r4-02-bay-friends-only.test.ts covers friends and the setting.
 * Needs the app with a database (the lead runs it).
 */

async function makeInvite(page: Page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/v1/bay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "fourup", mode: "async" }),
    });
    const d = await r.json();
    return { id: d.id as string, code: d.inviteCode as string };
  });
}

test("a stranger can't join an under-16 host's Board Bay invite, and is told why", async ({ browser }) => {
  const host = await guestContext(browser, { age: "13-15" });
  const stranger = await guestContext(browser, { age: "18+" });
  const { id, code } = await makeInvite(host.page);
  await stranger.page.goto(`/bay/${id}?join=${code}`);
  await stranger.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(stranger.page.getByText(/friends only/i)).toBeVisible();
  // Still the invite screen: no seat, no board.
  await expect(stranger.page.getByRole("button", { name: "Join", exact: true })).toBeVisible();
  await stranger.page.screenshot({ path: "docs/qa/screens/r4/r4-02-bay-friends-only-375.png" });
  await host.ctx.close();
  await stranger.ctx.close();
});

test("a 16+ host's Board Bay invite still lets anyone with the link in", async ({ browser }) => {
  const host = await guestContext(browser, { age: "16-17" });
  const other = await guestContext(browser, { age: "18+" });
  const { id, code } = await makeInvite(host.page);
  await other.page.goto(`/bay/${id}?join=${code}`);
  await other.page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(other.page.getByRole("button", { name: "Join", exact: true })).toHaveCount(0, { timeout: 15_000 });
  await expect(other.page.getByText(/friends only/i)).toHaveCount(0);
  await host.ctx.close();
  await other.ctx.close();
});
