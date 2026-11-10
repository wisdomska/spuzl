import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, VIEWPORTS } from "./harness";

/**
 * R4-01: Board Bay "Play live" is 16+ (the server answers 403 age_restricted). On the Library game card and the
 * Board Games world page a 13 to 15 player sees a muted "Opens at 16" note instead of a button that ends in an error;
 * Challenge a friend stays. 16+ players keep the Play live button. Needs the app with a database (the lead runs it).
 */

const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r4/r4-01-${name}-${w}.png` });

async function openChessCard(page: Page) {
  await page.goto("/library");
  await page.getByRole("link", { name: /^Chess\b/ }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("heading", { name: "Chess" })).toBeVisible();
  return card;
}

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`under 16 at ${label}: the Library card shows "Opens at 16", not a Play live button`, async ({ page }) => {
    await page.setViewportSize(size);
    await onboardGuest(page, "13-15");
    const card = await openChessCard(page);
    await expect(card.getByTestId("live-locked")).toBeVisible();
    await expect(card.getByTestId("live-locked")).toContainText("Opens at 16");
    await expect(card.getByRole("button", { name: /play live against another player/ })).toHaveCount(0);
    await expect(card.getByRole("button", { name: /Chess: challenge a friend/ })).toBeVisible();
    await shot(page, "card-under16", size.width);
  });

test("under 16: the Board Games world page shows the note too, and Challenge a friend still works", async ({ page }) => {
  await onboardGuest(page, "13-15");
  await page.goto("/world/board");
  await expect(page.getByTestId("live-locked").first()).toBeVisible();
  await expect(page.getByTestId("live-locked").first()).toContainText("Opens at 16");
  await expect(page.getByRole("link", { name: /play live against another player/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Chess: challenge a friend" }).click();
  await expect(page).toHaveURL(/\/bay\?new=chess/);
});

test("16+: the Library card and the world page keep the Play live button", async ({ page }) => {
  await onboardGuest(page, "16-17");
  const card = await openChessCard(page);
  await expect(card.getByRole("button", { name: "Chess: play live against another player" })).toBeVisible();
  await expect(card.getByTestId("live-locked")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/world/board");
  await expect(page.getByRole("link", { name: "Chess: play live against another player" })).toBeVisible();
  await expect(page.getByTestId("live-locked")).toHaveCount(0);
});
