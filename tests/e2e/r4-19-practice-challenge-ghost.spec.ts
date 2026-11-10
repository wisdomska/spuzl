import { expect, test, type Browser, type Page } from "@playwright/test";
import { onboardGuest, tapCell, VIEWPORTS, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * R4-19 (owner decision, 10 Nov 2026): a friend's challenge (/challenge/<code>) and a Ghost Race (/ghost/<game>)
 * run the practice round on the first try of a game the player doesn't know, and only then start the real, timed
 * run (no accept or ghost request before it). Players who know the game go straight in. Needs the app with a
 * database (the lead runs it).
 */
test.describe.configure({ mode: "serial" });

/** As in r2-p5-challenges.spec.ts (a spec can't import another spec): clear a free Crownfall, then Beat my time. */
async function clearAndChallenge(page: Page): Promise<string> {
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
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  const made = page.waitForResponse((r) => r.url().endsWith("/api/v1/challenges") && r.request().method() === "POST");
  await bar.getByRole("button", { name: "Challenge" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Beat my time/ })
    .click();
  return ((await (await made).json()) as { code: string }).code;
}

async function player(browser: Browser, guided: boolean) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone });
  const page = await ctx.newPage();
  await onboardGuest(page, { age: "18+", guided });
  return { ctx, page };
}

test("challenge: Accept opens the practice round first, then the race", async ({ browser }) => {
  const sender = await player(browser, false);
  const code = await clearAndChallenge(sender.page);

  const b = await player(browser, true);
  const accepts: string[] = [];
  b.page.on("request", (r) => r.url().endsWith(`/api/v1/challenges/${code}/accept`) && accepts.push(r.url()));
  await b.page.goto(`/challenge/${code}`);
  await b.page.getByRole("button", { name: "Accept" }).click();
  await expect(b.page.getByText("First time playing Crownfall?")).toBeVisible({ timeout: 15_000 });
  await waitForBoard(b.page);
  expect(accepts).toEqual([]);
  await b.page.screenshot({ path: "docs/qa/screens/r4/r4-19-challenge-practice-375.png" });

  const accepted = b.page.waitForResponse((r) => r.url().endsWith(`/api/v1/challenges/${code}/accept`));
  await b.page.getByRole("button", { name: "Skip the Crownfall practice round" }).click();
  expect((await accepted).status()).toBe(200);
  await waitForBoard(b.page);
  await expect(b.page.getByText("First time playing Crownfall?")).toHaveCount(0);
  await sender.ctx.close();
  await b.ctx.close();
});

test("challenge: a player who knows the game goes straight to the race", async ({ browser }) => {
  const sender = await player(browser, false);
  const code = await clearAndChallenge(sender.page);
  const b = await player(browser, false);
  await b.page.goto(`/challenge/${code}`);
  const accepted = b.page.waitForResponse((r) => r.url().endsWith(`/api/v1/challenges/${code}/accept`));
  await b.page.getByRole("button", { name: "Accept" }).click();
  expect((await accepted).status()).toBe(200);
  await expect(b.page.getByText("First time playing Crownfall?")).toHaveCount(0);
  await sender.ctx.close();
  await b.ctx.close();
});

test("ghost race: the practice round comes before the run is started", async ({ browser }) => {
  const p = await player(browser, true);
  const runs: string[] = [];
  p.page.on("request", (r) => r.method() === "POST" && /\/api\/v1\/ghosts\/dash$/.test(r.url()) && runs.push(r.url()));
  await p.page.goto("/ghost/dash");
  const coach = p.page.getByText("First time playing Dash?");
  await expect(coach).toBeVisible({ timeout: 20_000 });
  expect(runs).toEqual([]);
  const started = p.page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/v1\/ghosts\/dash$/.test(r.url()));
  await p.page.getByRole("button", { name: "Skip the Dash practice round" }).click();
  expect((await started).status()).toBe(200);
  await expect(coach).toHaveCount(0);
  await p.ctx.close();
});
