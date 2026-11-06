import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, VIEWPORTS } from "./harness";

/**
 * R2-02: the Duel entry for a 15-year-old. Challenge a friend is the primary action and makes a code in two taps
 * from Home (Duel, then Challenge a friend); Quick Match is a muted "Opens at 16" note, never a (disabled) button;
 * the game row opens a full-height picker with the Library's search and filters, keyboard and screen-reader
 * friendly. Needs the dev server and a database (the lead runs it).
 */
test.describe.configure({ mode: "serial" });

const entry = (page: Page) => page.getByRole("region", { name: "Duel" });

/** The section's lemon (primary) action: the one button whose background is the accent token. */
async function primaryActions(page: Page) {
  const accent = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.background = "var(--accent)";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  const names: string[] = [];
  for (const b of await entry(page).getByRole("button").all()) {
    const bg = await b.evaluate((el) => getComputedStyle(el).backgroundColor);
    if (bg === accent) names.push(((await b.textContent()) ?? "").trim());
  }
  return names;
}

test("a 15-year-old creates a friend duel in two taps: Duel, then Challenge a friend", async ({ page }) => {
  await onboardGuest(page, "13-15");
  await page.getByRole("navigation", { name: "More ways to play" }).getByRole("link", { name: "Duel" }).click();
  await expect(page).toHaveURL(/\/duel$/);
  // Any game is the default: nothing to pick first, and nothing is disabled.
  await expect(entry(page).getByRole("button", { name: /^Game: Any game/ })).toBeVisible();
  await entry(page)
    .getByRole("button", { name: /Challenge a friend/ })
    .click();
  await expect(page.getByRole("img", { name: /^Room code [A-Z0-9]( [A-Z0-9]){3}$/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Any game, best of 3/)).toBeVisible();
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`under 16 at ${size.width} px: Challenge a friend is primary, Quick Match is a locked note, nothing looks disabled`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size);
    await onboardGuest(page, "13-15");
    await page.goto("/duel");
    await expect(entry(page)).toBeVisible();
    await expect(entry(page).getByRole("button", { name: /Challenge a friend/ })).toBeEnabled();
    // Quick Match is not a button at all for under-16s, so it can never read as a disabled primary action.
    await expect(entry(page).getByRole("button", { name: /Quick Match/ })).toHaveCount(0);
    await expect(entry(page).getByText("Opens at 16")).toBeVisible();
    await expect(entry(page).locator("button:disabled, [aria-disabled='true']")).toHaveCount(0);
    expect(await primaryActions(page)).toEqual([expect.stringMatching(/^Challenge a friend/)]);
    await info.attach(`duel-entry-under16-${label}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });

test("16+ keeps Quick Match as the primary action, enabled with Any game", async ({ page }) => {
  await onboardGuest(page, "16-17");
  await page.goto("/duel");
  await expect(entry(page).getByRole("button", { name: /Quick Match/ })).toBeEnabled();
  expect(await primaryActions(page)).toEqual([expect.stringMatching(/^Quick Match/)]);
  await expect(entry(page).getByRole("button", { name: /Challenge a friend/ })).toBeEnabled();
});

test("the game picker is a full-height sheet with the Library's search and filters, usable by keyboard", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phone);
  await onboardGuest(page, "13-15");
  await page.goto("/duel");
  const row = entry(page).getByRole("button", { name: /^Game: Any game/ });
  await row.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Pick a game" });
  await expect(sheet).toBeVisible();
  // Full height: the sheet reaches from near the top of the screen to the bottom.
  const box = (await sheet.boundingBox())!;
  expect(box.height).toBeGreaterThan(VIEWPORTS.phone.height * 0.9);
  // Keyboard/mouse: the search box has focus. Touch: focus stays in the sheet without opening the on-screen keyboard.
  const search = sheet.getByRole("searchbox", { name: "Search games" });
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) {
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await search.focus();
  } else await expect(search).toBeFocused();
  // The same filter chips as All games are there.
  await expect(sheet.getByRole("group", { name: "Filter games" }).getByRole("button", { name: "Quick" })).toBeVisible();
  await page.keyboard.type("crownfall");
  await expect(sheet.getByRole("button", { name: /Crownfall/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Any game/ })).toHaveCount(0);
  await page.keyboard.press("Tab"); // clear search
  await page.keyboard.press("Tab"); // first filter chip
  for (let i = 0; i < 30; i++) {
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    if (/Crownfall/.test(focused)) break;
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  await expect(sheet).toBeHidden();
  await expect(row.or(entry(page).getByRole("button", { name: /^Game: Crownfall/ }))).toBeFocused();
  await expect(entry(page).getByRole("button", { name: /^Game: Crownfall/ })).toBeVisible();
  // Escape closes it without changing the pick.
  await entry(page)
    .getByRole("button", { name: /^Game: Crownfall/ })
    .click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(entry(page).getByRole("button", { name: /^Game: Crownfall/ })).toBeVisible();
});

test("axe: the Duel entry and the game picker have no serious or critical violations", async ({ page }) => {
  await onboardGuest(page, "13-15");
  await page.goto("/duel");
  await expect(entry(page)).toBeVisible();
  const serious = async () =>
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
  expect(await serious()).toEqual([]);
  await entry(page)
    .getByRole("button", { name: /^Game:/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Pick a game" })).toBeVisible();
  expect(await serious()).toEqual([]);
});
