import { expect, test } from "@playwright/test";
import { ALL_SLUGS, ageOf, duelFriend, keepFocus, onboardGuest, openTestBoard, partyRoom, runAxe, solveSeeded, VIEWPORTS } from "./harness";

/**
 * Round 2 harness self-test: every helper the R2 tickets rely on does what it says. Needs a server with the dev
 * fixtures (ENABLE_DEV_ROUTES=1) and a database; guests it creates are listed for cleanup like the perf run's.
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/harness-r2.spec.ts --project=phone-375
 */
test.describe.configure({ mode: "serial" });

test("onboardGuest({ birthYear }) puts the guest in the right age band", async ({ browser }) => {
  const year = new Date().getUTCFullYear();
  for (const [age, band] of [
    [15, "13-15"],
    [16, "16-17"],
    [25, "18+"],
  ] as const) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.phone });
    const page = await ctx.newPage();
    // a January birthday: the age is simply this year minus the birth year
    await onboardGuest(page, { birthYear: year - age, birthMonth: 1 });
    expect(ageOf(year - age, 1)).toBe(age);
    const me = await page.evaluate(() => fetch("/api/v1/me").then((r) => r.json()));
    expect(me.age_band).toBe(band);
    await ctx.close();
  }
});

test("keepFocus: a board in a background page does not pause", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone });
  const a = await ctx.newPage();
  await keepFocus(a);
  await openTestBoard(a, "crownfall", "qa");
  const b = await ctx.newPage();
  await b.goto("about:blank");
  await b.bringToFront();
  await a.waitForTimeout(800);
  expect(await a.evaluate(() => document.hasFocus() && document.visibilityState === "visible")).toBe(true);
  await expect(a.getByRole("dialog", { name: /paused/i })).toHaveCount(0);
  await ctx.close();
});

test("seeded boards: every game opens its deterministic puzzle at 375 and 1280 px", async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  const failed: string[] = [];
  for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await keepFocus(page);
    for (const slug of ALL_SLUGS) {
      try {
        await openTestBoard(page, slug, "qa");
      } catch {
        failed.push(`${slug}@${vp.width}`);
      }
    }
    await ctx.close();
  }
  expect(failed).toEqual([]);
});

test("solveSeeded plays a seeded Crownfall to the end", async ({ page }) => {
  await keepFocus(page);
  await solveSeeded(page, "crownfall", "qa");
  await expect(page.getByText(/solved|cleared|crowns? placed/i).first()).toBeVisible({ timeout: 15_000 });
});

test("duelFriend: two players meet in a friend duel by code", async ({ browser }) => {
  const { host, guest, code } = await duelFriend(browser);
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  // both end up in the same duel (lobby or countdown)
  await expect(guest.page).toHaveURL(/\/duel/, { timeout: 30_000 });
  await expect(host.page.getByText(guest.nickname).first()).toBeVisible({ timeout: 30_000 });
  await host.ctx.close();
  await guest.ctx.close();
});

test("partyRoom(3): three players in one room", async ({ browser }) => {
  const { code, players } = await partyRoom(browser, 3);
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  for (const p of players.slice(1)) await expect(players[0].page.getByText(p.nickname).first()).toBeVisible({ timeout: 30_000 });
  for (const p of players) await p.ctx.close();
});

test("runAxe reports serious and critical issues on Home", async ({ page }) => {
  await onboardGuest(page);
  const v = await runAxe(page);
  // The harness only proves the scan runs; the counts go into the baseline report.
  test.info().annotations.push({ type: "axe-home", description: v.map((x) => `${x.id} (${x.nodes.length})`).join(", ") || "none" });
  expect(Array.isArray(v)).toBe(true);
});
