import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Desktop hover (owner, 12 Nov 2026): on a mouse, clickable things react when hovered (buttons and cards brighten,
 * text links dim, with a pointer cursor); on a touch phone nothing reacts, so no hover state sticks after a tap.
 * Public pages only, so it needs no account. Needs a server (PW_BASE_URL).
 */
const LOOK = ["filter", "opacity", "backgroundColor", "color", "boxShadow", "outlineStyle", "transform"] as const;
const look = (l: Locator) =>
  l.evaluate(
    (e, props) => {
      const cs = getComputedStyle(e);
      return Object.fromEntries(props.map((p) => [p, cs[p as never] as string]));
    },
    LOOK as unknown as string[],
  );

async function hoverChanges(page: Page, l: Locator) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  const before = await look(l);
  await l.hover();
  await page.waitForTimeout(250);
  const after = await look(l);
  return LOOK.some((p) => before[p] !== after[p]);
}

test.describe("desktop hover", () => {
  test.skip(({ isMobile }) => !!isMobile, "mouse only");

  test("buttons, cards and links react to the mouse, with a pointer cursor", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.goto("/");
    const play = page.getByRole("link", { name: /Play now/ }).first();
    await expect(play).toBeVisible();
    expect(await hoverChanges(page, play)).toBe(true);
    expect(await play.evaluate((e) => getComputedStyle(e).cursor)).toBe("pointer");

    await page.goto("/games");
    const tab = page.getByRole("tab").nth(1);
    expect(await hoverChanges(page, tab)).toBe(true);
    const card = page
      .locator('a[href^="/games/"]')
      .filter({ hasText: /Crownfall/ })
      .first();
    expect(await hoverChanges(page, card)).toBe(true);
    const footerLink = page.getByRole("link", { name: "Privacy" }).last();
    expect(await hoverChanges(page, footerLink)).toBe(true);
    await ctx.close();
  });
});

test("a phone shows no hover state, before or after a tap", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/games");
  expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(false);
  const tab = page.getByRole("tab").nth(1);
  const before = await look(tab);
  await tab.tap();
  await page.getByRole("tab").nth(2).tap();
  await page.waitForTimeout(300);
  // The first tapped tab is no longer selected: it must look exactly as it did (no stuck hover).
  expect((await look(tab)).filter).toBe(before.filter);
  expect((await look(tab)).opacity).toBe(before.opacity);
  await ctx.close();
});
