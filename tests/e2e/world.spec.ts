import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/** World screen: one card per game with its Challenge and vs-bot actions inside it; no Daily wording. */
test("world: each game is one card with its own actions", async ({ page }, info) => {
  await onboardGuest(page);
  await page.goto("/world/line");
  await expect(page.getByText(/of \d+ tried\./)).toBeVisible();
  await expect(page.getByText(/cleared today|Daily/)).toHaveCount(0);
  const card = page.locator("main li").first();
  await expect(card.getByRole("link").first()).toBeVisible();
  await expect(card.getByRole("group", { name: /More ways to play/ }).getByRole("button", { name: /Challenge/ })).toBeVisible();
  await page.screenshot({ path: `docs/qa/screens/after/world-line-${info.project.name}.png` });
  await page.goto("/world/board");
  await expect(page.locator("main li").first().getByRole("link", { name: "Play vs bot" })).toBeVisible();
  await page.screenshot({ path: `docs/qa/screens/after/world-board-${info.project.name}.png` });
});
