import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/** SPZ-14: search, filter chips, one action per row opening the game card, no horizontal scroll. */
test("library: search, filters and the game card", async ({ page }, info) => {
  await onboardGuest(page);
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "All games" })).toBeVisible();
  await expect(page.getByText("51 games")).toBeVisible();

  await page.getByRole("button", { name: "Quick", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quick", exact: true })).toHaveAttribute("aria-pressed", "true");
  const quick = await page.getByText(/^\d+ games$/).textContent();
  expect(Number(quick!.split(" ")[0])).toBeLessThan(51);
  await page.getByRole("button", { name: "All", exact: true }).click();

  await page.getByRole("searchbox").fill("crownf");
  await expect(page.getByText("1 game")).toBeVisible();
  await page.screenshot({ path: `docs/qa/screens/after/library-search-${info.project.name}.png` });
  await page.getByRole("button", { name: /^Crownfall Logic Lab/ }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("heading", { name: "Crownfall" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Today's Daily" })).toHaveCount(0); // Dailies are off
  await page.screenshot({ path: `docs/qa/screens/after/library-card-${info.project.name}.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await card.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForURL(/\/play\/crownfall\?mode=free/);
});
