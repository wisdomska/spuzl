import { expect, test } from "@playwright/test";
import { onboardGuest, tapCell, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/** Free play ends on the compact bar: header stays, named Next, Another and Challenge side by side. */
test("free play: compact result bar with named next actions", async ({ page }, info) => {
  await onboardGuest(page);
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
  await expect(bar.getByRole("button", { name: /^Next in / })).toBeVisible();
  await expect(bar.getByRole("button", { name: /^Another Crownfall/ })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Challenge" })).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(1);
  await page.screenshot({ path: `docs/qa/screens/after/free-result-${info.project.name}.png` });
});
