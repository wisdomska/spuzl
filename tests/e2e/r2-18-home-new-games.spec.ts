import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, VIEWPORTS } from "./harness";
import { GAMES } from "@/lib/catalog";

/**
 * R2-18 Home: "N new games to try" (the games tagged new: the catalog's isNew unless the admin Library page changed
 * them) is in the notification bell (owner, 13 Nov 2026) and opens All games filtered to New. The
 * Continue card shows a tiny static board and, for a game with levels, the level it opens.
 * Needs the app with a database and migration 20261201001801 (no admin "new" overrides set).
 */

const NEW = GAMES.filter((g) => g.isNew);
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/R2-18-${name}-${w}.png` });
const continueCard = (page: Page) => page.locator("main a[data-play-nav]").filter({ has: page.locator("[data-board-thumb]") });

const bell = (page: Page) => page.locator("[data-bell]");
const list = (page: Page) => page.getByRole("dialog", { name: "Notifications" });
const newItem = (page: Page) => list(page).getByRole("button", { name: new RegExp(`^${NEW.length} new games to try`) });

test("new games are in the bell and open the Library on New", async ({ page }) => {
  await onboardGuest(page);
  await expect(page.locator("[data-new-games]")).toHaveCount(0);
  await bell(page).click();
  await newItem(page).click();
  await page.waitForURL(/\/library\?filter=new$/);
  await expect(page.getByRole("button", { name: "New", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(`${NEW.length} games`, { exact: true })).toBeVisible();
  for (const g of NEW) await expect(page.getByRole("link", { name: new RegExp(`^${g.name} `) })).toBeVisible();
});

test("removing new games keeps them out of the bell on the next visit", async ({ page }) => {
  await onboardGuest(page);
  await bell(page).click();
  await list(page)
    .getByRole("button", { name: /^Remove: \d+ new games/ })
    .click();
  await expect(newItem(page)).toHaveCount(0);
  await page.reload();
  await bell(page).click();
  await expect(newItem(page)).toHaveCount(0);
});

test("Continue shows a tiny board and the level it opens", async ({ page }) => {
  await onboardGuest(page);
  const card = continueCard(page);
  await expect(card).toBeVisible();
  // A new guest's first game is Crownfall, which has levels: "Level 1 · Puzzles".
  await expect(card).toContainText(/Level \d+ · /);
  const thumb = card.locator("[data-board-thumb] svg").first();
  await expect(thumb).toBeVisible();
  // R2-01 warm-up still targets the Continue link; the thumb is plain SVG (no board image or chunk for it).
  await expect(card).toHaveAttribute("href", /\/play\/[a-z0-9]+\?mode=level/);
  expect(await card.locator("img").count()).toBe(0);
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`screens at ${label} (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size);
    await onboardGuest(page);
    await expect(continueCard(page).first()).toBeVisible();
    await shot(page, "home", size.width);
    await bell(page).click();
    await newItem(page).click();
    await expect(page.getByRole("button", { name: "New", exact: true })).toHaveAttribute("aria-pressed", "true");
    await shot(page, "library-new", size.width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
