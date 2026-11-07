import { expect, test, type Page } from "@playwright/test";
import { admin } from "../api/helpers";
import { onboardGuest, tapCell, VIEWPORTS, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * R2-P5 streak shield: "Save your streak" gives the free streak shield as the reason to sign in. The prompt's
 * clear count is set to 1 for the run (admin setting guest.signInPromptAfterClears) and put back after. Needs the dev
 * server and a database. The lead runs it.
 */
test.describe.configure({ mode: "serial" });

const KEY = "guest.signInPromptAfterClears";
let before: unknown;
test.beforeAll(async () => {
  before = (await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle()).data?.value;
  await admin().from("game_settings").upsert({ key: KEY, value: 1 }, { onConflict: "key" });
});
test.afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await admin().from("game_settings").upsert({ key: KEY, value: before }, { onConflict: "key" });
});

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
  await expect(page.getByRole("status").filter({ hasText: "Cleared" })).toBeVisible({ timeout: 15_000 });
}

for (const [name, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test(`Save your streak offers the free streak shield (${name})`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    await onboardGuest(page);
    await clearFreeCrownfall(page);
    const prompt = page.locator('[data-prompt="save_streak"]');
    await expect(prompt).toBeVisible({ timeout: 15_000 });
    await expect(prompt.getByRole("heading", { name: "Save your streak" })).toBeVisible();
    await expect(prompt).toContainText("Sign in and get a free streak shield");
    await page.screenshot({ path: `docs/qa/screens/r2/p5-streak-shield-${name}.png` });
    await prompt.getByRole("button", { name: "Sign in and get a free streak shield" }).click();
    await expect(page.getByRole("dialog", { name: "Save your streak" })).toContainText("a free Streak Freeze lands in your bag");
    await page.screenshot({ path: `docs/qa/screens/r2/p5-streak-shield-sheet-${name}.png` });
  });
}
