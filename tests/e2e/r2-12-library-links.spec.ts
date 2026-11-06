import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, VIEWPORTS } from "./harness";
import { GAME_COUNT } from "@/lib/catalog";

/**
 * R2-12 Library: every row is a real link to /play/<game> (so long-press, open in a new tab and share work), a plain
 * tap still opens the game card, all rows render at once, the Emoji Hits tile shows, and a ladder game's card
 * names the player's next level ("Play Level 1" for a new guest) with "All levels" as a secondary link.
 * Needs the app with a database (release defaults: Dailies off).
 */

const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/R2-12-${name}-${w}.png` });

test("rows are links: href, Ctrl-click opens a new page, a plain click opens the card", async ({ page, context }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();

  // Every row is there at once (no row-by-row reveal), each an anchor to its game.
  const rows = page.locator("main ul > li > a");
  await expect(rows).toHaveCount(GAME_COUNT);
  const row = page.getByRole("link", { name: /^Crownfall Puzzles/ });
  await expect(row).toHaveAttribute("href", "/play/crownfall");
  expect(await row.evaluate((a) => a.tagName)).toBe("A");

  // Ctrl/Cmd-click: the browser opens the game in a new page; this page stays on the Library with no card.
  const [popup] = await Promise.all([context.waitForEvent("page"), row.click({ modifiers: ["ControlOrMeta"] })]);
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).pathname).toBe("/play/crownfall");
  await popup.close();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A plain click opens the card in place, and starts no attempt (only the card's buttons do).
  const attempts: string[] = [];
  page.on("request", (r) => r.method() === "POST" && r.url().endsWith("/api/v1/attempts") && attempts.push(r.url()));
  await row.click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("heading", { name: "Crownfall" })).toBeVisible();
  await expect(page).toHaveURL(/\/library$/);
  await page.waitForTimeout(500);
  expect(attempts).toEqual([]);
});

test("a ladder game's card says which level plays next; All levels is the secondary link", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await page.getByRole("link", { name: /^Crownfall Puzzles/ }).click();
  const card = page.getByRole("dialog");
  const play = card.getByRole("button", { name: "Play Level 1", exact: true });
  await expect(play).toBeVisible();
  await expect(play).toBeFocused();
  await expect(card.getByRole("button", { name: "Free play", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: /All levels$/ })).toBeVisible();
  await expect(card.getByRole("button", { name: "Levels", exact: true })).toHaveCount(0);
  await play.click();
  await page.waitForURL(/\/play\/crownfall\?mode=level&level=1/);
});

test("a game without levels keeps Play as its primary", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await page.getByRole("searchbox").fill("emoji");
  await page.getByRole("link", { name: /^Emoji Hits/ }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: /^Play Level/ })).toHaveCount(0);
});

test("the Emoji Hits icon renders in its row and card (not an empty tile)", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await page.getByRole("searchbox").fill("emoji");
  await page.getByRole("link", { name: /^Emoji Hits/ }).click();
  const icon = page.getByRole("dialog").locator('[data-game-icon="emojihits"]');
  await expect(icon).toBeVisible();
  const drawn = await icon.evaluate(async (el) => {
    if (el instanceof HTMLImageElement) {
      if (!el.complete) await new Promise((r) => el.addEventListener("load", r, { once: true }));
      return el.naturalWidth > 0;
    }
    // The flat fallback tile: an svg with the smiley's path in it.
    return !!el.querySelector("svg path");
  });
  expect(drawn).toBe(true);
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`screens at ${label} (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size);
    await onboardGuest(page);
    await page.goto("/library");
    await expect(page.locator("main ul > li > a")).toHaveCount(GAME_COUNT);
    await shot(page, "list", size.width);
    await page.getByRole("link", { name: /^Crownfall Puzzles/ }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /^Play Level \d+$/ })).toBeVisible();
    await shot(page, "card-ladder", size.width);
    await page.keyboard.press("Escape");
    await page.getByRole("searchbox").fill("emoji");
    await page.getByRole("link", { name: /^Emoji Hits/ }).click();
    await expect(page.getByRole("dialog").locator('[data-game-icon="emojihits"]')).toBeVisible();
    await shot(page, "card-emojihits", size.width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
