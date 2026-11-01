/**
 * Tap-to-interactive timings for the four journeys in docs/qa/BASELINE.md, plus every API call fired.
 * Run against a production build with the local Supabase stack:
 *   pnpm build && pnpm start -p 3400
 *   PW_BASE_URL=http://localhost:3400 RUNS=10 pnpm exec playwright test tests/perf --project=perf
 * Writes docs/qa/perf-<label>.json (label from PERF_LABEL, default "run").
 */
import { execSync } from "node:child_process";
import { GAMES } from "@/lib/catalog";
import { writeFileSync, mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { onboardGuest, throttle, waitForBoard, VIEWPORTS, tapCell } from "../e2e/harness";

const RUNS = Number(process.env.RUNS ?? 10);
const LABEL = process.env.PERF_LABEL ?? "run";
type Sample = { ms: number; api: string[] };
const results: Record<string, Sample[]> = {};

function record(page: Page) {
  const api: string[] = [];
  const on = (r: { url(): string; method(): string }) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) api.push(`${r.method()} ${u.pathname}`);
  };
  page.on("request", on);
  return { api, stop: () => page.off("request", on) };
}

async function measure(key: string, page: Page, act: () => Promise<void>, done: () => Promise<unknown>) {
  const rec = record(page);
  const t0 = Date.now();
  await act();
  await done();
  const ms = Date.now() - t0;
  rec.stop();
  (results[key] ??= []).push({ ms, api: rec.api });
}

function todaysCrownfall(): number[] {
  const out = execSync(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -tAc "select p.solution from dailies d join puzzles p on p.id=d.puzzle_id where d.date=(now() at time zone 'utc')::date and d.game_id='crownfall'"`,
  )
    .toString()
    .trim();
  return JSON.parse(out);
}

for (const profile of ["desktop", "4g-phone"] as const) {
  test.describe(profile, () => {
    test.describe.configure({ mode: "serial", timeout: 30 * 60_000 });
    test.use({ viewport: profile === "desktop" ? VIEWPORTS.desktop : VIEWPORTS.phone });

    test("Enter The Grid → Home", async ({ browser }) => {
      for (let i = 0; i < RUNS; i++) {
        const ctx = await browser.newContext({ viewport: profile === "desktop" ? VIEWPORTS.desktop : VIEWPORTS.phone });
        const page = await ctx.newPage();
        if (profile !== "desktop") await throttle(page, "4g");
        await page.goto("/welcome");
        await page.evaluate(
          (ids) => localStorage.setItem("spuzl.learned", JSON.stringify(ids)),
          GAMES.map((g) => g.id),
        );
        await page.getByRole("button", { name: "Play as guest" }).click();
        await page.getByRole("radio", { name: /18 or older/ }).click();
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
        await page.locator("#nick").fill(`Pf${Date.now() % 1e7}`);
        await measure(
          `${profile}:enter-grid`,
          page,
          () => page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click(),
          () => page.locator('a[href^="/play/"]').first().waitFor({ state: "visible", timeout: 60_000 }),
        );
        await ctx.close();
      }
    });

    test("Home Play, Library row, Daily results Next", async ({ browser }) => {
      const sol = todaysCrownfall();
      for (let i = 0; i < RUNS; i++) {
        const ctx = await browser.newContext({ viewport: profile === "desktop" ? VIEWPORTS.desktop : VIEWPORTS.phone });
        const page = await ctx.newPage();
        await onboardGuest(page);
        if (profile !== "desktop") await throttle(page, "4g");
        // Home "Play" (today's next Daily, Crownfall for a new player)
        await page.goto("/");
        await page.locator('a[href^="/play/"]').first().waitFor();
        await page.waitForTimeout(1500); // idle, as a player would be
        await measure(
          `${profile}:home-play`,
          page,
          () => page.locator('a[href^="/play/"]').first().click(),
          () => waitForBoard(page, 60_000),
        );
        // Solve today's Crownfall, then time results "Next puzzle"
        const n = sol.length;
        for (let r = 0; r < n; r++) {
          await tapCell(page, r + 1, sol[r] + 1);
          await tapCell(page, r + 1, sol[r] + 1);
          if (r === 0) await page.waitForTimeout(7000); // stay above the anti-cheat human floor
        }
        const next = page.getByRole("button", { name: /^Next/ }).first();
        await next.waitFor({ timeout: 60_000 });
        await measure(
          `${profile}:results-next`,
          page,
          async () => {
            await next.click();
            // celebrations may sit between results and the next board today; tap through them
            for (let k = 0; k < 6; k++) {
              const b = page.getByRole("dialog").getByRole("button");
              if (await b.count()) await b.first().click();
              else break;
            }
          },
          () => waitForBoard(page, 60_000),
        );
        // Library row (first game)
        // SPZ-14: a row opens the game card; the timed tap is the card's primary action.
        await page.goto("/library");
        await page
          .getByRole("button", { name: /Open game card$/ })
          .nth(1)
          .click();
        const primary = page
          .getByRole("dialog")
          .getByRole("button", { name: /Today's Daily|Free play/ })
          .first();
        await primary.waitFor();
        await page.waitForTimeout(1500);
        await measure(
          `${profile}:library-row`,
          page,
          () => primary.click(),
          () => waitForBoard(page, 60_000),
        );
        await ctx.close();
      }
    });
  });
}

test.afterAll(() => {
  mkdirSync("docs/qa", { recursive: true });
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length - 1) * p))];
  const summary = Object.fromEntries(
    Object.entries(results).map(([k, v]) => [
      k,
      {
        runs: v.length,
        p50: pct(
          v.map((s) => s.ms),
          0.5,
        ),
        p95: pct(
          v.map((s) => s.ms),
          0.95,
        ),
        api: [...new Set(v.flatMap((s) => s.api))],
      },
    ]),
  );
  writeFileSync(`docs/qa/perf-${LABEL}.json`, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, summary }, null, 2));
});
