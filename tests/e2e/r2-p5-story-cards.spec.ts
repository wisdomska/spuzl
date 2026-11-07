import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, tapCell, VIEWPORTS, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * R2-P5 story cards: Share on the free-play result bar makes a challenge on the same puzzle on the server and opens
 * the share sheet with the 9:16 story card (Spuz in the equipped hat, the time, "Beat me" and the short link).
 * Needs the dev server and a database. The lead runs it.
 */
async function clearFreeCrownfall(page: Page) {
  const started = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST");
  await page.goto("/play/crownfall?mode=free");
  const puzzle = (await (await started).json()).puzzle as CrownfallPuzzle;
  await waitForBoard(page);
  const sol = solve(puzzle)!;
  for (let r = 0; r < sol.length; r++) {
    await tapCell(page, r + 1, sol[r] + 1);
    await tapCell(page, r + 1, sol[r] + 1);
    if (r === 0) await page.waitForTimeout(6500); // above the human floor
  }
  const bar = page.getByRole("status").filter({ hasText: "Cleared" });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  return bar;
}

for (const [name, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test(`story card at ${name}: Share on a free clear opens the 9:16 Beat me card`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await onboardGuest(page);
    const bar = await clearFreeCrownfall(page);
    const story = page.waitForResponse((r) => r.url().endsWith("/api/v1/share/story"));
    await bar.getByRole("button", { name: "Share" }).click();
    const body = (await (await story).json()) as { code: string; image: string; text: string };
    const sheet = page.getByTestId("share-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Dare a friend on Crownfall" })).toBeVisible();
    const img = sheet.getByRole("img", { name: /Your Crownfall story card/ });
    await expect(img).toHaveAttribute("src", new RegExp(`/api/og/challenge/${body.code}\\?format=story`));
    await expect(img).toHaveJSProperty("complete", true);
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(sheet.getByLabel("Share text")).toContainText(`/c/${body.code}`);
    await page.screenshot({ path: `docs/qa/screens/r2/p5-story-sheet-${name}.png` });
    // The card itself, for the QA report.
    const png = await page.request.get(body.image);
    expect(png.status()).toBe(200);
    await ctx.close();
  });
}
