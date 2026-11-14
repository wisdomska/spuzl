import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/** Kente (owner, 14 Nov 2026): Sixer and Nine are one game; free play asks for the board size first. */
test("Kente asks 6 × 6 or 9 × 9, then plays that size", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/play/sixer?mode=free");
  await expect(page.getByRole("heading", { name: "Kente: pick a board" })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${process.env.SHOTS ?? "test-results"}/kente-picker.png` });
  await page.getByRole("button", { name: /9\s×\s9/ }).click();
  await page.waitForURL(/\/play\/nine\?.*size=1/);
  await expect(page.locator("[data-shell]")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Kente", level: 1 })).toBeVisible();
});

test("the Library lists Kente once", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await expect(page.getByRole("link", { name: /^Kente/ })).toHaveCount(1);
});
