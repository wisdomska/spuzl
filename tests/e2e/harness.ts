/**
 * QA harness for SPUZL end-to-end tests (Playwright). Shared helpers for every spec:
 *
 *   onboardGuest(page, age)            first run as a guest, lands on Home
 *   openGame(page, slug, mode)         /play/<slug>?mode=… and waits for the board
 *   openTestBoard(page, slug, seed, d) seeded, server-free board (/dev/board fixture, deterministic)
 *   solveTestBoard(page, slug, seed)   solves a seeded board by tapping (games with a tap solver below)
 *   tapCell(page, row, col)            taps a grid cell by its accessible name ("Row r, column c, …")
 *   duelVsBot(page)                    starts a Practice-bot Duel
 *   openPartyRoom(page)                opens a Party room, returns its 4-character code
 *   throttle(page, profile)            network profile via CDP (Chromium): "4g" | "slow3g" | "offline" | "none"
 *
 * Seeded puzzles come from the game's own generator (same code as the server), so tests never depend on
 * today's Daily. The /dev routes exist only when ENABLE_DEV_ROUTES=1 or outside production.
 */
import { expect, type Page } from "@playwright/test";
import { GAMES } from "@/lib/catalog";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";

export type Age = "13-15" | "16-17" | "18+";
const AGE_LABEL: Record<Age, RegExp> = { "13-15": /13 to 15/, "16-17": /16 to 17/, "18+": /18 or older/ };

export async function onboardGuest(page: Page, age: Age = "18+", nickname = `Qa${Date.now() % 1e7}`, o: { guided?: boolean } = {}) {
  await page.goto("/welcome");
  // Most tests go straight to the real game; the guided first play has its own test.
  if (!o.guided)
    await page.evaluate(
      (ids) => localStorage.setItem("spuzl.learned", JSON.stringify(ids)),
      GAMES.map((g) => g.id),
    );
  await page.getByRole("button", { name: "Play as guest" }).click();
  await page.getByRole("radio", { name: AGE_LABEL[age] }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
  await page.locator("#nick").fill(nickname);
  await page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  return nickname;
}

/** The board is interactive when its grid (or main board region) is visible and not aria-disabled. */
export async function waitForBoard(page: Page, timeout = 30_000) {
  const board = page
    .locator('[role="grid"], [role="listbox"], main[aria-label$=" board"] canvas, main[aria-label$=" board"] button')
    .first();
  await board.waitFor({ state: "visible", timeout });
  return board;
}

export async function openGame(page: Page, slug: string, mode: "daily" | "free" = "free") {
  await page.goto(`/play/${slug}?mode=${mode}`);
  return waitForBoard(page);
}

export async function openTestBoard(page: Page, slug: string, seed = "qa", d: Difficulty = "easy", state?: unknown) {
  const q = new URLSearchParams({ seed, d });
  if (state !== undefined) q.set("state", JSON.stringify(state));
  await page.goto(`/dev/board/${slug}?${q}`);
  return waitForBoard(page);
}

export async function tapCell(page: Page, row: number, col: number) {
  await page
    .getByRole("gridcell", { name: new RegExp(`^Row ${row}, column ${col}\\b`) })
    .first()
    .click();
}

/** Per-game solvers that play the seeded solution through real taps. Extend as games get contract tests. */
const SOLVERS: Record<string, (page: Page, seed: string, d: Difficulty) => Promise<void>> = {
  async crownfall(page, seed, d) {
    const { generate } = await import("@/games/crownfall/logic");
    const g = generate(createRng(seed), d);
    // tap mode cycles empty → X → crown, so two taps place a crown
    for (let r = 0; r < g.solution.length; r++) {
      await tapCell(page, r + 1, g.solution[r] + 1);
      await tapCell(page, r + 1, g.solution[r] + 1);
    }
  },
};

export async function solveTestBoard(page: Page, slug: string, seed = "qa", d: Difficulty = "easy") {
  const solve = SOLVERS[slug];
  if (!solve) throw new Error(`no tap solver for ${slug} yet`);
  await openTestBoard(page, slug, seed, d);
  await solve(page, seed, d);
}

export async function duelVsBot(page: Page) {
  await page.goto("/duel");
  // Quick Match, past the rules card for a game never cleared (SPZ-12), then the Practice bot (offered at once).
  await page
    .getByRole("button", { name: /Quick Match/ })
    .first()
    .click();
  const ready = page.getByRole("button", { name: /I'm ready/ });
  const bot = page.getByRole("button", { name: /Practice bot/ });
  await expect(ready.or(bot).first()).toBeVisible({ timeout: 20_000 });
  if (await ready.isVisible()) await ready.click();
  await bot.first().click();
  await page.waitForURL(/\/duel\?m=/, { timeout: 30_000 });
  return waitForBoard(page, 45_000);
}

export async function openPartyRoom(page: Page) {
  await page.goto("/party");
  await page
    .getByRole("button", { name: /Open (a )?room|Host/i })
    .first()
    .click();
  await page.waitForURL(/\/party\/[A-Z0-9]{4}/, { timeout: 30_000 });
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Chrome DevTools network profiles (Lighthouse's "slow 4G" and Chrome's "slow 3G"). */
const PROFILES = {
  "4g": { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  slow3g: { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 },
  offline: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
  none: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
} as const;

export async function throttle(page: Page, profile: keyof typeof PROFILES) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", PROFILES[profile]);
  if (profile !== "none") await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

/** Exactly one visible clock element (role="timer") on screen: the GameShell contract. */
export async function expectOneTimer(page: Page) {
  await expect(page.locator('[role="timer"]:visible')).toHaveCount(1);
}

export const VIEWPORTS = { phone: { width: 375, height: 812 }, desktop: { width: 1280, height: 800 } } as const;
