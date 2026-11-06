import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, pickBirth, tapCell, waitForBoard } from "./harness";
import { createRng } from "@/lib/rng";

/**
 * R2-05 Daily Five, end to end: the Home card above the map, playing through today's five (tap solvers where the
 * harness has one for the game, the API for the rest), the share grid with the copy fallback (navigator.share
 * stubbed away), and the /daily deep link for a first-time visitor (onboarding, then straight back).
 * Needs the app with a database (Dailies off, "dailyFive.enabled" on: the release defaults).
 */

type Five = { date: string; games: { slot: number; game: string; name: string; state: string }[]; done: number; total: number };

const fiveOf = async (page: Page): Promise<Five> => (await page.request.get("/api/v1/daily-five")).json();

/** The board the server made for (game, date): the same seeds and uniqueness check as lib/daily-five/server.ts. */
const LOGIC: Record<string, () => Promise<unknown>> = {
  crownfall: () => import("@/games/crownfall/logic"),
  trotro: () => import("@/games/trotro/logic"),
};
async function fiveBoard<T extends { puzzle: unknown; solution: unknown }>(game: string, date: string): Promise<T> {
  const logic = (await LOGIC[game]()) as {
    generate: (rng: ReturnType<typeof createRng>, d: string) => T;
    countSolutions?: (p: unknown, limit: number) => number;
  };
  for (let k = 0; k < 3; k++) {
    const g = logic.generate(createRng(k ? `five:${game}:${date}:${k}` : `five:${game}:${date}`), "easy");
    if (!logic.countSolutions || logic.countSolutions(g.puzzle, 2) === 1) return g;
  }
  throw new Error(`no board for ${game}`);
}

/** Tap solvers for Daily Five games (the same moves as the harness solvers, on the five's board). */
const SOLVE: Record<string, (page: Page, date: string) => Promise<void>> = {
  async crownfall(page, date) {
    const g = await fiveBoard<{ puzzle: { size: number }; solution: number[] }>("crownfall", date);
    for (let r = 0; r < g.solution.length; r++) {
      // Stay above the human floor (6 s) so the clear is ranked, not flagged.
      if (r === g.solution.length - 1) await page.waitForTimeout(6500);
      await tapCell(page, r + 1, g.solution[r] + 1);
      await tapCell(page, r + 1, g.solution[r] + 1);
    }
  },
  async trotro(page, date) {
    const { applyMove } = await import("@/games/trotro/logic");
    type P = import("@/games/trotro/logic").TrotroPuzzle;
    const { puzzle: p, solution } = await fiveBoard<{ puzzle: P; solution: { moves: [number, number][] } }>("trotro", date);
    let pos = p.start;
    await page.waitForTimeout(5500);
    for (const [v, delta] of solution.moves) {
      const veh = p.vehicles[v];
      const lead = delta > 0 ? pos[v] + veh.len - 1 + delta : pos[v] + delta;
      const cell = (k: number) => (veh.axis === "h" ? [veh.line, k] : [k, veh.line]);
      const [r0, c0] = cell(pos[v]);
      const [r1, c1] = cell(lead);
      await tapCell(page, r0 + 1, c0 + 1);
      await tapCell(page, r1 + 1, c1 + 1);
      pos = applyMove(p, pos, [v, delta])!;
    }
  },
};

test.describe("R2-05 Daily Five", () => {
  test("Home shows the Daily Five card above the map, and it opens the first game", async ({ page }) => {
    await onboardGuest(page);
    const card = page.getByTestId("daily-five-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Daily Five #\d+/);
    await expect(card).toContainText("0/5");
    await expect(card).toHaveAccessibleName(/Daily Five: 0 of 5 played, 0 points/);
    const map = page.getByRole("region", { name: "The Grid" });
    const c = (await card.boundingBox())!;
    const m = (await map.boundingBox())!;
    expect(c.y + c.height).toBeLessThanOrEqual(m.y + 1);
    const five = await fiveOf(page);
    await card.click();
    await page.waitForURL(new RegExp(`/play/${five.games[0].game}\\?mode=five`));
    await waitForBoard(page);
  });

  test("plays through the five, then shares the grid (copy fallback without the Web Share API)", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    await onboardGuest(page);
    const five = await fiveOf(page);
    expect(five.total).toBe(5);

    for (const g of five.games) {
      const solve = SOLVE[g.game];
      if (solve) {
        // Through the screen: the game ends on the Daily Five bar, never the free-play loop.
        await page.goto(`/play/${g.game}?mode=five`);
        await waitForBoard(page);
        await expect(page.getByText(/Daily Five · \d of 5/)).toBeVisible();
        await solve(page, five.date);
        const bar = page.getByTestId("five-result");
        await expect(bar).toBeVisible({ timeout: 15_000 });
        await expect(bar.getByRole("button", { name: /^(Next: .+ \(\d of 5\)|See my Daily Five)$/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Another / })).toHaveCount(0);
      } else {
        // No tap solver for this game: start and finish it through the API (an empty board is a miss).
        const s = await page.request.post("/api/v1/attempts", { data: { game: g.game, mode: "five" } });
        expect(s.status(), g.game).toBe(200);
        const { attemptId } = await s.json();
        const f = await page.request.post(`/api/v1/attempts/${attemptId}/finish`, { data: { state: null, activeMs: 20_000, mistakes: 0 } });
        expect(f.status(), g.game).toBe(200);
      }
    }

    // Home: the ring is full and the card leads to the share.
    await page.goto("/");
    const card = page.getByTestId("daily-five-card");
    await expect(card).toContainText("5/5");
    await expect(card).toContainText("All five done");
    await card.click();
    await page.waitForURL(/\/daily$/);

    // The grid: text only, one row per game, a link back to /daily.
    const grid = page.getByTestId("daily-five-grid");
    await expect(grid).toBeVisible();
    const text = (await grid.textContent())!;
    const lines = text.trim().split("\n");
    expect(lines[0]).toMatch(/^SPUZL Daily Five #\d+ · \d+\/1000$/);
    expect(lines).toHaveLength(7);
    for (const [i, g] of five.games.entries()) expect(lines[i + 1]).toContain(g.name);
    expect(lines.at(-1)).toMatch(/\/daily$/);

    // navigator.share is undefined here, so Share copies the grid instead.
    await page.getByRole("button", { name: "Share my grid" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text.trim());
  });

  test("the /daily deep link sends a first-time visitor through onboarding, then back to today's five", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/daily");
    await page.waitForURL(/\/intro\?return=daily/);
    // The intro hands over to Welcome by itself.
    await page.waitForURL(/\/welcome/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Play as guest" }).click();
    await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
    await pickBirth(page, "18+");
    await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
    await page.locator("#nick").fill(`Qd${Date.now() % 1e7}`);
    await page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click();
    await page.waitForURL((u) => u.pathname === "/daily", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Daily Five" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Daily Five" }).getByRole("listitem")).toHaveCount(5);
    await ctx.close();
  });
});
