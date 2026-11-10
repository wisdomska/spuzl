import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * R4-05: linking Google from "Save your streak" returns through /auth/callback with `?shield=1` when the streak
 * shield was granted. The return page thanks the player in a toast (like the email path's card) and strips the
 * param, so a reload doesn't thank twice. Google itself can't run here, so the spec opens the return URL the
 * callback builds. Needs the app with a database (the lead runs it).
 */

test("?shield=1 shows the thank-you once and leaves the address clean", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/?auth=linked&shield=1");
  const toast = page.getByTestId("shield-thanks");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveText(/free streak shield is in/);
  await expect(toast).toHaveAttribute("role", "status");
  await expect(page).toHaveURL((u) => u.pathname === "/" && !u.searchParams.has("shield") && u.searchParams.get("auth") === "linked");
  await page.screenshot({ path: "docs/qa/screens/r4/r4-05-shield-thanks-375.png" });
  // It goes away by itself.
  await expect(toast).toHaveCount(0, { timeout: 8_000 });
  // A reload doesn't thank again.
  await page.reload();
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId("shield-thanks")).toHaveCount(0);
});

test("pages without the param never show it", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId("shield-thanks")).toHaveCount(0);
});
