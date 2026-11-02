import { expect, test } from "@playwright/test";
import { openTestBoard } from "./harness";

/**
 * Word games and the device's keyboard: a computer (fine, hovering pointer) gets the typing keys instead of the
 * on-screen letter keyboard and types with the physical keys; a phone (touch) keeps the on-screen keys.
 */
const isDesktop = (name: string) => name.startsWith("desktop");

test("Rungs: typing keys on a computer, physical typing, Show / Hide keyboard; on-screen keys on a phone", async ({ page }, info) => {
  await openTestBoard(page, "rungs");
  const onScreen = page.getByRole("group", { name: "Letter keyboard" });
  const typing = page.getByRole("group", { name: "Typing keys" });
  if (!isDesktop(info.project.name)) {
    await expect(onScreen).toBeVisible();
    await expect(typing).toHaveCount(0);
    await onScreen.getByRole("button", { name: "Q", exact: true }).click();
    await expect(page.getByRole("gridcell", { name: /^Rung 1\..*typed Q$/ })).toBeVisible();
    return;
  }
  await expect(typing).toBeVisible();
  await expect(onScreen).toHaveCount(0);
  // The physical keyboard types into the active rung, and Backspace takes it back.
  await page.keyboard.press("q");
  await page.keyboard.press("z");
  await expect(page.getByRole("gridcell", { name: /^Rung 1\..*typed QZ$/ })).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("gridcell", { name: /^Rung 1\..*typed Q$/ })).toBeVisible();
  // A touch laptop can bring the keys back, and hide them again; the choice is remembered.
  await typing.getByRole("button", { name: "Show keyboard" }).click();
  await expect(onScreen).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Letter keyboard" })).toBeVisible();
  await page.getByRole("button", { name: "Hide keyboard" }).click();
  await expect(page.getByRole("group", { name: "Typing keys" })).toBeVisible();
});

test("Minicross: the clue list beside the grid and physical typing on a computer", async ({ page }, info) => {
  test.skip(!isDesktop(info.project.name), "computer layout");
  await openTestBoard(page, "minicross");
  await expect(page.getByRole("group", { name: "Letter keyboard" })).toHaveCount(0);
  await expect(page.getByRole("complementary").getByText("Across", { exact: false }).first()).toBeVisible();
  await page.keyboard.press("k");
  await expect(page.getByRole("gridcell", { name: /Row 1, column 1, K/ })).toBeVisible();
});

test("Rungs: the ladder, the input and the tools fit the screen without a scroll", async ({ page }) => {
  await openTestBoard(page, "rungs");
  await expect(page.getByRole("button", { name: /^Hint/ })).toBeInViewport();
  const over = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(over).toBeLessThanOrEqual(1);
});
