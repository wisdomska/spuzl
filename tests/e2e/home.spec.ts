import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/** SPZ-16: one Play card with the Today ring; Duel and Party as small chips; the map keeps 70 % of the screen. */
test("home: one Play card, chips, and room for the map", async ({ page }, info) => {
  await onboardGuest(page);
  const card = page.getByRole("link", { name: /^(Play|Continue:) .*(Today's Dailies|Games tried): \d+ of \d+/ });
  await expect(card).toBeVisible();
  await expect(page.getByRole("navigation", { name: "More ways to play" }).getByRole("link")).toHaveCount(3);
  const box = await card.boundingBox();
  const vh = page.viewportSize()!.height;
  // The dock starts at the Play card (the at-risk card only shows after 7 pm with a streak).
  if (info.project.name === "phone-375") expect(box!.y / vh).toBeGreaterThanOrEqual(0.7);
  await page.screenshot({ path: `docs/qa/screens/after/home-${info.project.name}.png` });
  await card.click();
  await page.waitForURL(/\/play\//);
});
