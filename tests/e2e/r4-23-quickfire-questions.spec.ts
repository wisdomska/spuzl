import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * R4-23: Quickfire hands out each question only when it opens. The scored board's payload carries no question
 * text or option; Start opens question 1 on the server, which sends it back; answers stay hidden until then, the
 * drain bar runs, and a lost connection while fetching the next question offers Try again.
 */
test.describe("R4-23 Quickfire questions on open", () => {
  test.setTimeout(120_000);

  test("the board payload has no questions; each arrives on its open; offline offers Try again", async ({ page, context }) => {
    await onboardGuest(page);
    const served = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST");
    await page.goto("/play/quickfire?mode=free");
    const payload = await (await served).json();
    expect(payload.puzzle.count).toBe(5);
    expect(payload.puzzle).not.toHaveProperty("questions");
    expect(JSON.stringify(payload.puzzle)).not.toMatch(/"choices"|"q":/);

    const start = page.getByRole("button", { name: /^Start\b/ });
    await start.waitFor({ timeout: 45_000 });
    const answers = page.getByRole("group", { name: /answers/i });
    await expect(answers.getByRole("button")).toHaveCount(0);

    // Start: the open goes to the server and its reply carries the question.
    const opened = page.waitForResponse((r) => r.url().includes("/api/games/quickfire/guess"));
    await start.click();
    const first = await (await opened).json();
    expect(first).toMatchObject({ ok: true, question: { q: expect.any(String), choices: expect.any(Array) } });
    await expect(answers.getByRole("button")).toHaveCount(4);
    // The question shows on the card (and once more for screen readers): the visible one is enough.
    await expect(page.getByText(first.question.q).first()).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /time left/i })).toBeVisible();

    // Wait past the reading floor, answer, and cut the connection before the next question is fetched.
    await page.waitForTimeout(1500);
    const judged = page.waitForResponse((r) => r.url().includes("/api/games/quickfire/guess"));
    await answers.getByRole("button").first().click();
    await judged;
    await context.setOffline(true);
    const retry = page.getByRole("button", { name: /^Try again\b/ });
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await expect(answers.getByRole("button")).toHaveCount(0);
    await expect(page.getByText(/No connection yet/)).toBeVisible();

    // Back online: Try again fetches question 2 and play goes on.
    await context.setOffline(false);
    await retry.click();
    await expect(answers.getByRole("button")).toHaveCount(4, { timeout: 15_000 });
    await expect(page.getByText(/Question 2 of 5/).first()).toBeVisible();
  });
});
