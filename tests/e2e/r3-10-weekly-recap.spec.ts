import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, openGame, runAxe, VIEWPORTS } from "./harness";
import { recapWeeks } from "@/lib/recap/weekly";

/**
 * R3-10 weekly recap: on the first Home visit of the GMT week, last week's card (clears, best time and game, streak,
 * league, Sparks) with Share my week and Play today's Daily. Through the prompt queue (one prompt at a time), never
 * on play screens, once a week per device, dismissible.
 *
 * A brand-new guest has no last week, so the recap API is answered with a fixture for most tests (the server side is
 * covered by tests/api/r3-10-weekly-recap.test.ts); the first test uses the real, empty answer. The fixture's card
 * image is the design sample (/api/og/sample/recap, hidden on production: run against preview or local).
 * Needs migration 20261207001001 and the admin setting "weeklyRecap.enabled" on (the default).
 */
const { thisWeek, recapWeek } = recapWeeks(new Date());
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r3/R3-10-${name}-${w}.png` });
const card = (page: Page) => page.getByTestId("weekly-recap");
/** The row opens the full week in a dialog (owner, 13 Nov 2026). */
async function openWeek(page: Page) {
  await card(page)
    .getByRole("button", { name: /Your week/ })
    .click();
  const d = page.getByRole("dialog", { name: "Your week, chale!" });
  await expect(d).toBeVisible();
  return d;
}

const FIXTURE = {
  thisWeek,
  week: recapWeek,
  recap: {
    week: recapWeek,
    cleared: 12,
    best: { game: "crownfall", ms: 42_000 },
    streak: 12,
    league: { tier: 1, rank: 4, result: "promoted" },
    sparks: 145,
  },
  stats: [
    { id: "best", label: "Best time", value: "0:42 in Crownfall" },
    { id: "streak", label: "Streak", value: "🔥 12 days" },
    { id: "league", label: "League", value: "Up to Gold Crown" },
    { id: "sparks", label: "Sparks earned", value: "+145" },
  ],
  card: {
    image: "/api/og/sample/recap",
    width: 1080,
    height: 1920,
    text: "My week on SPUZL: 12 games cleared. Come and play: spuzl.vercel.app",
    alt: "My week on SPUZL: 12 games cleared",
  },
};

async function mockRecap(page: Page) {
  let calls = 0;
  await page.route("**/api/v1/me/weekly-recap", async (route) => {
    calls++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FIXTURE) });
  });
  return () => calls;
}

test("a new player with no last week sees no recap", async ({ page }) => {
  await onboardGuest(page);
  await expect(page.locator("main a[data-play-nav]").first()).toBeVisible();
  await page.waitForTimeout(1500); // past the queue's settle time
  await expect(card(page)).toHaveCount(0);
});

test("shows last week once, through the prompt queue, and never again this week", async ({ page }) => {
  const calls = await mockRecap(page);
  await onboardGuest(page);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("Your week: 12 games cleared");
  const week = await openWeek(page);
  await expect(week).toContainText("0:42 in Crownfall");
  await expect(week).toContainText("12 days");
  await expect(week).toContainText("Up to Gold Crown");
  await expect(week).toContainText("+145");
  await page.keyboard.press("Escape");
  // One prompt per screen visit: nothing else holds a prompt slot next to it.
  await expect(page.locator("[data-prompt]")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("spuzl.weeklyRecap"))).toBe(thisWeek);
  expect(await runAxe(page, { include: "[data-testid=weekly-recap]" })).toEqual([]);

  await page.reload();
  await expect(page.locator("main a[data-play-nav]").first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(card(page)).toHaveCount(0);
  // Already shown this week: the recap isn't even fetched again.
  const after = calls();
  await page.reload();
  await page.waitForTimeout(1500);
  expect(calls()).toBe(after);
});

test("closes with the close button", async ({ page }) => {
  await mockRecap(page);
  await onboardGuest(page);
  await expect(card(page)).toBeVisible();
  await card(page).getByRole("button", { name: "Close the weekly recap" }).click();
  await expect(card(page)).toHaveCount(0);
});

test("Share my week opens the share sheet with the card", async ({ page }) => {
  await mockRecap(page);
  await onboardGuest(page);
  await (await openWeek(page)).getByRole("button", { name: "Share my week" }).click();
  const sheet = page.getByRole("dialog", { name: "Share your week" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("img", { name: "Your week on SPUZL card" })).toBeVisible();
});

test("Play today's Daily goes to the Daily Five", async ({ page }) => {
  await mockRecap(page);
  await onboardGuest(page);
  await (await openWeek(page)).getByRole("link", { name: "Play today's Daily" }).click();
  await page.waitForURL(/\/daily$/);
});

test("never on a play screen", async ({ page }) => {
  await mockRecap(page);
  await onboardGuest(page);
  await page.evaluate(() => localStorage.removeItem("spuzl.weeklyRecap"));
  await openGame(page, "crownfall", "free");
  await page.waitForTimeout(1500);
  await expect(card(page)).toHaveCount(0);
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`screens at ${label} (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockRecap(page);
    await onboardGuest(page);
    await expect(card(page)).toBeVisible();
    await shot(page, "home", size.width);
    await (await openWeek(page)).getByRole("button", { name: "Share my week" }).click();
    await expect(page.getByRole("dialog", { name: "Share your week" })).toBeVisible();
    await shot(page, "share", size.width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
