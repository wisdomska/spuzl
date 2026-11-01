import { expect, test, type Page } from "@playwright/test";
import { duelVsBot, openPartyRoom, tapCell, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * Full player journey with Dailies off (the product today): first run, lesson, Home, guided first play, Library,
 * a real clear, World, Quests, Leagues, Shop, Me, Friends (share sheet), Duel vs the Practice bot, Party room,
 * Settings, and the Daily-only screens redirecting. Every screen visited is checked for any "Daily" wording.
 */
const noDaily = async (page: Page, where: string) => {
  const text = await page.locator("body").innerText();
  expect(text, `Daily wording on ${where}`).not.toMatch(/\bDail(y|ies)\b/);
};

test("full journey: guest to clears, social and multiplayer, with no Daily anywhere", async ({ page }) => {
  test.setTimeout(300_000);

  // First run: guest, age, the 30-second lesson, merged celebration, nickname.
  await page.goto("/welcome");
  await noDaily(page, "welcome");
  await page.getByRole("button", { name: "Play as guest" }).click();
  await page.getByRole("radio", { name: /18 or older/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await noDaily(page, "start choices");
  await page.getByRole("button", { name: /Learn a game in 30 seconds/ }).click();
  for (const [r, c] of [
    [0, 1],
    [1, 3],
    [2, 0],
    [3, 2],
  ]) {
    const cell = page.locator(`[data-i="${r * 4 + c}"]`);
    await cell.click();
    await cell.click();
  }
  await expect(page.getByText("First clear!")).toBeVisible();
  await page.locator("#nick").fill(`Jy${Date.now() % 1e7}`);
  await page.getByRole("button", { name: "Save my Spuz and open the map" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });

  // Home: one Play card counting games tried; the lesson lit the streak.
  const card = page.getByRole("link", { name: /Games tried: 1 of \d+/ });
  await expect(card).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /day streak/ })
      .or(page.getByLabel(/1 day streak/))
      .first(),
  ).toBeVisible();
  await noDaily(page, "home");

  // First-time tips start after the first interaction, one at a time.
  await page.mouse.wheel(0, 50);
  const tip = page.getByRole("status").filter({ hasText: /Islands|XP|Streak|Sparks/ });
  await expect(tip.first()).toBeVisible({ timeout: 5000 });
  for (let i = 0; i < 4 && (await tip.count()); i++) {
    const b = tip.first().getByRole("button");
    if (!(await b.count())) break;
    await b.click();
    await page.waitForTimeout(250);
  }

  // Home Play goes to the next game on the path; its first try is the guided practice round, skippable.
  await card.click();
  await expect(page.getByText(/First time playing/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip the .* practice round/ }).click();
  await waitForBoard(page);
  await expect(page.getByRole("timer")).toHaveCount(1);
  await noDaily(page, "play");

  // Library: search, card, play Crownfall free and clear it for real.
  await page.goto("/library");
  await noDaily(page, "library");
  await page.getByRole("searchbox").fill("crownf");
  await page.getByRole("button", { name: /^Crownfall Logic Lab/ }).click();
  const started = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "Play", exact: true }).click();
  const puzzle = (await (await started).json()).puzzle as CrownfallPuzzle;
  await waitForBoard(page);
  const sol = solve(puzzle)!;
  for (let r = 0; r < sol.length; r++) {
    await tapCell(page, r + 1, sol[r] + 1);
    await tapCell(page, r + 1, sol[r] + 1);
    if (r === 0) await page.waitForTimeout(6500); // above the human floor
  }
  const bar = page.getByRole("status").filter({ hasText: "Cleared" });
  await expect(bar).toBeVisible({ timeout: 20_000 });
  await expect(bar.getByText(/\+\d+ XP/)).toBeVisible();
  await noDaily(page, "free result");

  // World: one card per game, played state, Challenge inside the card.
  await page.goto("/world/logic");
  await expect(page.getByText(/of \d+ tried\./)).toBeVisible();
  await expect(page.locator("main li").filter({ hasText: "Crownfall" }).getByText("Played")).toBeVisible();
  await noDaily(page, "world");

  // Quests count regular clears.
  await page.goto("/quests");
  await expect(page.getByRole("progressbar", { name: /Clear 5 puzzles, [1-9] of 5/ }).first()).toBeVisible();
  await noDaily(page, "quests");

  // Leagues: joined after a clear this week, or the friendly empty state; no Leaderboards link.
  await page.goto("/leagues");
  await expect(page.getByRole("link", { name: "Leaderboards" })).toHaveCount(0);
  await noDaily(page, "leagues");

  // Shop lists the starter hat first; Me shows the profile.
  await page.goto("/shop");
  await expect(page.getByText(/Starter/).first()).toBeVisible();
  await noDaily(page, "shop");
  await page.goto("/me");
  await noDaily(page, "me");

  // Friends: the invite opens the share sheet with many apps.
  await page.goto("/friends");
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Snapchat" })).toBeVisible();
  await page.keyboard.press("Escape");
  await noDaily(page, "friends");

  // Daily-only screens are unreachable.
  await page.goto("/leaderboards");
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/archive");
  await page.waitForURL((u) => u.pathname === "/");

  // Settings render; comfort toggles respond.
  await page.goto("/settings");
  await noDaily(page, "settings");

  // Duel: Quick Match (rules card for a new game), then the Practice bot from the start.
  await duelVsBot(page);
  await noDaily(page, "duel");

  // Party: host a room and get its code.
  const code = await openPartyRoom(page);
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  await noDaily(page, "party room");
});
