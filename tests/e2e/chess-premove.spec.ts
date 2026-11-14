import { expect, test, type Page } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * Premoves vs Spuzl (owner, 14 Nov 2026): while Spuzl is thinking you can plan your next move; it shows on the board
 * as queued and is played the moment your turn comes. Guests this creates are listed in QA_GUEST_LOG for
 * scripts/qa/delete-test-guests.mjs.
 */
const sq = (page: Page, n: string) => page.getByRole("gridcell", { name: new RegExp(`^${n}\\b`) });

test("chess vs Spuzl: a premove made during Spuzl's turn is played when the turn comes", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/play/chess/bot");
  const skip = page.getByRole("button", { name: /Skip the .* practice round/ });
  if (await skip.isVisible({ timeout: 8000 }).catch(() => false)) await skip.click();
  await sq(page, "e2").waitFor({ timeout: 20_000 });

  await sq(page, "e2").click();
  await sq(page, "e4").click();
  // Spuzl waits a beat before it answers: plan Nf3 now (the same two taps, on its turn).
  // (each tap in its own task, as a person's would be; the board must take the first before the second)
  for (const n of ["g1", "f3"])
    await page.evaluate((n) => document.querySelector<HTMLElement>(`[role="gridcell"][data-sq="${n}"]`)!.click(), n);
  await expect(sq(page, "f3")).toHaveAttribute("aria-label", /premove g1 to f3 queued/);

  // Spuzl replies, the premove plays at once: Nf3 is in the move list and the queue is empty.
  const moves = page.locator("[data-chess-moves]").first();
  await expect(moves).toContainText("Nf3", { timeout: 10_000 });
  await expect(sq(page, "f3")).toHaveAttribute("aria-label", /white knight/);
  await expect(sq(page, "f3")).not.toHaveAttribute("aria-label", /premove/);
  await expect(sq(page, "g1")).toHaveAttribute("aria-label", /^g1(, last move)?$/);
  // and Spuzl answers that too (the game goes on)
  await expect.poll(() => moves.textContent(), { timeout: 10_000 }).toMatch(/2\.\s*Nf3\S+/);
});
