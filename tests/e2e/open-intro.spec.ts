/**
 * The logo intro (owner, 13 Nov 2026): the landing page's Play goes through it, the app plays it once when opened
 * (a reload of the same visit goes straight to Home, never the landing page), and not again right after signing up.
 */
import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";
test("landing play goes through the intro", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /Play now/ })
    .first()
    .click();
  await page.waitForURL(/\/intro/);
  await page.waitForURL(/\/welcome\/play/, { timeout: 8000 });
});
test("app open plays the intro once per visit", async ({ page }) => {
  await onboardGuest(page);
  await page.evaluate(() => sessionStorage.removeItem("spuzl-opened"));
  await page.goto("/");
  await expect(page.locator(".open-splash main")).toBeVisible();
  await expect(page.locator(".open-splash")).toHaveCount(0, { timeout: 6000 });
  await page.reload();
  await page.waitForTimeout(200);
  expect(
    await page
      .locator(".open-splash main")
      .isVisible()
      .catch(() => false),
  ).toBe(false);
  await expect(page.getByRole("link", { name: "Me" }).first()).toBeVisible();
});
test("no intro on Home right after signing up", async ({ page }) => {
  await onboardGuest(page);
  await page.waitForTimeout(300);
  expect(await page.locator(".open-splash main").count()).toBe(0);
});
