import { expect, test, type Page } from "@playwright/test";
import { createRng } from "@/lib/rng";
import { generate } from "@/games/draughts/logic";
import { captureLines, count } from "@/games/draughts/engine";
import { openTestBoard } from "./harness";

/**
 * Draughts puzzles on the 10 × 10 board (owner, 23 Nov 2026): the Daily and Free play puzzle is International. A
 * shorter capture line can be planned and played, but leaves pieces behind and is refused; the line that takes every
 * piece clears the board. Same generator as the server, so the test knows the answer.
 */
const SEED = "qa-intl";
const g = generate(createRng(SEED), "hard");
const shorter = captureLines(g.puzzle.board, 0).find((m) => m.caps.length < count(g.puzzle.board, 1))!;

async function playLine(page: Page, path: number[]) {
  const grid = page.getByRole("grid", { name: /Draughts board/ });
  for (const sq of path) await grid.locator(`[data-i="${sq}"]`).click();
  await page.getByRole("button", { name: "Play chain" }).click();
}

test("10 × 10 puzzle: a shorter line is refused, the full line clears the board", async ({ page }) => {
  test.setTimeout(120_000);
  await openTestBoard(page, "draughts", SEED, "hard");
  const grid = page.getByRole("grid", { name: /Draughts board/ });
  await expect(grid).toHaveAttribute("aria-rowcount", "10");
  await expect(grid.getByRole("gridcell")).toHaveCount(100);
  await expect(page.getByText("You must take the most pieces.").first()).toBeVisible();

  await playLine(page, shorter.path);
  await expect(page.getByText("Pieces left on the board.").first()).toBeVisible();
  // the refused line is undone (the plan clears a moment later): every piece is back
  await expect(grid.locator('[aria-selected="true"]')).toHaveCount(0);
  await expect(grid.getByRole("gridcell", { name: /rival (piece|king)/ })).toHaveCount(count(g.puzzle.board, 1));

  await playLine(page, g.solution.path);
  await expect(page.getByText("Board cleared.").first()).toBeVisible();
});
