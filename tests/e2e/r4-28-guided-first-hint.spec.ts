import { expect, test } from "@playwright/test";
import { GAME_BY_ID } from "@/lib/catalog";
import { guidedCopy } from "@/lib/copy/guided";
import { onboardGuest, VIEWPORTS } from "./harness";

/**
 * R4-28 Guided first play: before any move, Hint on the Dusk, Nine and Merge practice rounds gives a real first
 * move (a cell with a ring and its reason, or a swipe with its arrow), not the "Start anywhere." rule coach. The
 * server's answer is checked too: a target, and text that isn't the rule.
 * Needs a server with a database (guest onboarding). Screenshots: docs/qa/screens/r2/r4-28-<game>-375.png.
 */
// Merge is retired (players can't open it), so its first hint is covered by the unit test only
// (tests/unit/game/guided-first-hint.test.ts).
const GAMES = ["dusk", "nine"] as const;

test.use({ viewport: VIEWPORTS.phone });

for (const id of GAMES) {
  test(`${id}: the first hint before any move is a real move, not the rule`, async ({ page }) => {
    await onboardGuest(page, "18+", undefined, { guided: true });
    await page.goto(`/play/${id}?mode=free`);
    await expect(page.getByText(`First time playing ${GAME_BY_ID[id].name}?`)).toBeVisible({ timeout: 30_000 });
    // Merge holds its board behind a Start button; the hint is for the board as dealt.
    const start = page.getByRole("button", { name: /^Start\b/ });
    if (await start.count()) await start.first().click();

    const answer = page.waitForResponse((r) => r.url().endsWith(`/api/v1/guided/${id}`) && r.request().method() === "POST");
    await page.getByRole("button", { name: /^Hint\b/ }).click();
    const { hint } = (await (await answer).json()) as { hint: { target: unknown; text: string } | null };
    expect(hint).not.toBeNull();
    expect(hint!.target).not.toBeNull();
    expect(hint!.text).not.toContain(guidedCopy.ruleHint);
    expect(hint!.text).not.toContain(GAME_BY_ID[id].rule);
    await expect(page.getByText(hint!.text).first()).toBeVisible();
    // The board shows where (a ringed cell, or Merge's arrow).
    await expect(page.locator(".hint-ring").first()).toBeVisible();
    await page.screenshot({ path: `docs/qa/screens/r2/r4-28-${id}-375.png` });
  });
}
