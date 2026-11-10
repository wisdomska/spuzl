import { expect, test, type Page } from "@playwright/test";
import { admin } from "../api/helpers";
import { onboardGuest, tapCell, VIEWPORTS, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * R4-20 Free-play clears get a share image with story cards off. Share on the free-play result bar opens the share
 * sheet with the free-play card (`/api/og/free/<attempt>`: the game's colours, the time, "Free play", no Daily
 * number), and the image renders. The free card route refuses anything but a verified free-play clear.
 *
 * Turns "features.storyCards" off straight in game_settings (as tests/api/setup.ts setSetting does) and puts the old
 * value back. Needs a server with a database, reading settings without a cache (development, or SETTINGS_CACHE_MS=0);
 * it flips a shared setting, so run it with --workers=1. The lead runs it.
 * Screenshots: docs/qa/screens/r2/r4-20-free-share-<375|1280>.png.
 */
const KEY = "features.storyCards";
let before: unknown = undefined;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
  before = data?.value;
  const { error } = await admin().from("game_settings").upsert({ key: KEY, value: false }, { onConflict: "key" });
  if (error) throw error;
});
test.afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await admin().from("game_settings").upsert({ key: KEY, value: before }, { onConflict: "key" });
});

async function clearFreeCrownfall(page: Page) {
  const started = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST");
  await page.goto("/play/crownfall?mode=free");
  const body = (await (await started).json()) as { attemptId: string; puzzle: CrownfallPuzzle };
  await waitForBoard(page);
  const sol = solve(body.puzzle)!;
  for (let r = 0; r < sol.length; r++) {
    await tapCell(page, r + 1, sol[r] + 1);
    await tapCell(page, r + 1, sol[r] + 1);
    if (r === 0) await page.waitForTimeout(6500); // above the human floor
  }
  const bar = page.getByRole("status").filter({ hasText: "Cleared" });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  return { bar, attemptId: body.attemptId };
}

for (const [name, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test(`free card at ${name}: Share on a free clear with story cards off shows the free-play card`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await onboardGuest(page);
    const { bar, attemptId } = await clearFreeCrownfall(page);
    let storyAsked = false;
    page.on("request", (r) => {
      if (r.url().endsWith("/api/v1/share/story")) storyAsked = true;
    });
    await bar.getByRole("button", { name: "Share" }).click();
    const sheet = page.getByTestId("share-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Crownfall on SPUZL" })).toBeVisible();
    const img = sheet.locator(`img[src*="/api/og/free/${attemptId}"]`);
    await expect(img).toHaveCount(1);
    await expect(img).toHaveJSProperty("complete", true);
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(sheet.getByLabel("Share text")).toContainText("SPUZL · Crownfall · Free play ·");
    await expect(sheet.getByLabel("Share text")).not.toContainText("#0");
    expect(storyAsked).toBe(false);
    await page.screenshot({ path: `docs/qa/screens/r2/r4-20-free-share-${name}.png` });

    const png = await page.request.get(`/api/og/free/${attemptId}`);
    expect(png.status()).toBe(200);
    expect(png.headers()["content-type"]).toContain("image/png");
    // The Daily card stays refused for a free clear, and the free card for an unknown attempt.
    expect((await page.request.get(`/api/og/daily/${attemptId}`)).status()).toBe(404);
    expect((await page.request.get("/api/og/free/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
    await ctx.close();
  });
}
