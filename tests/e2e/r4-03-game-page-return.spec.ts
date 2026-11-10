import { expect, test, type Page } from "@playwright/test";
import { logGuest, pickBirth } from "./harness";

/**
 * R4-03: a signed-out visitor who taps Play on /games/<id> goes through onboarding and lands on that game, not on
 * Home. `?return=game:<id>` is honoured for real catalog games only (lib/onboarding-return.ts, unit tested); an
 * unknown id falls back to the usual destination. Needs the app with a database (the lead runs it).
 */

/** From wherever the gate sends a first-run visitor (intro, Welcome or the age step) to a saved guest profile. */
async function finishOnboarding(page: Page) {
  const born = page.getByRole("heading", { name: /When were you born\?/ });
  const guest = page.getByRole("button", { name: "Play as guest" });
  await expect(born.or(guest)).toBeVisible({ timeout: 15_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(born).toBeVisible();
  await pickBirth(page, "18+");
  await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
  await page.locator("#nick").fill(`Qa${Date.now() % 1e7}`);
  await page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click();
}

test("Play on a game's page returns to that game after onboarding", async ({ page }) => {
  await page.goto("/games/sixer");
  await page
    .getByRole("link", { name: /^Play Sixer free$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/[?&]return=game(%3A|:)sixer/, { timeout: 15_000 });
  await finishOnboarding(page);
  await page.waitForURL((u) => u.pathname === "/play/sixer", { timeout: 30_000 });
  await logGuest(page);
  await page.screenshot({ path: "docs/qa/screens/r4/r4-03-back-to-game-375.png" });
});

test("an unknown game in ?return= is ignored: onboarding ends on Home", async ({ page }) => {
  await page.goto("/welcome/play?return=game:nope");
  await finishOnboarding(page);
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await logGuest(page);
});

test("a ?return= that points off the site is ignored", async ({ page }) => {
  await page.goto("/welcome/play?return=https://example.com");
  await finishOnboarding(page);
  await page.waitForURL((u) => u.pathname === "/" && u.host !== "example.com", { timeout: 30_000 });
  await logGuest(page);
});
