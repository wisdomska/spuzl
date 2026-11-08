import { expect, test, type Browser } from "@playwright/test";
import { onboardGuest, VIEWPORTS } from "./harness";

/**
 * R3-03 Home on a phone does less while it loads (Lighthouse mobile TBT). What is deferred, and what must not move:
 * - the desktop side panel's content (friends, levels) is neither downloaded nor rendered below 1024 px;
 * - the live inbox connection and the friends request wait until the screen is quiet (a few seconds after load);
 * - the Continue card and its warm prefetch (R2-01) are still there at once.
 * The scores themselves are measured on production by the lead (Lighthouse mobile on /).
 */
async function guestState(browser: Browser) {
  const setup = await browser.newContext();
  const page = await setup.newPage();
  await onboardGuest(page);
  const state = await setup.storageState();
  await setup.close();
  return state;
}

test("phone: Continue card at once, no side panel content, no friends request while loading", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: await guestState(browser), viewport: VIEWPORTS.phone });
  const page = await ctx.newPage();
  const early: string[] = [];
  const t0 = Date.now();
  page.on("request", (r) => {
    if (Date.now() - t0 < 2500) early.push(new URL(r.url()).pathname);
  });
  await page.goto("/");
  await expect(page.locator('main a[href^="/play/"]').first()).toBeVisible();
  // The hidden desktop panel holds only its placeholder on a phone.
  await expect(page.getByRole("heading", { name: "Friends online" })).toHaveCount(0);
  await page.waitForTimeout(2500);
  expect(
    early.filter((p) => p.startsWith("/api/v1/friends")),
    "no friends request while Home loads on a phone",
  ).toEqual([]);
  await ctx.close();
});

test("desktop: the side panel still fills in after load", async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ storageState: await guestState(browser), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/");
  const panel = page.getByRole("complementary", { name: "Today" });
  await expect(panel.getByRole("heading", { name: "Friends online" })).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator('a[href^="/play/"], a[href="/library"]').first()).toBeVisible();
  await ctx.close();
});
