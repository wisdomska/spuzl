/**
 * Round 2 baseline (docs/qa/BASELINE_R2.md): tap-to-interactive-board for the audit's journeys, cold and warm,
 * desktop (1280 × 800, no throttling) and phone (375 × 812, Lighthouse "slow 4G" + 4× CPU), plus a waterfall of
 * every request and long task between the tap and the board.
 *
 *   Cold  = a fresh browser context (empty HTTP cache, no service worker) signed in as the guest: the first game of
 *           the session, as on a phone that just opened SPUZL.
 *   Warm  = the same journey again in that context.
 *
 * Journeys: Home Continue/Play, Library → card → Play, results "Next level", and landing "Play now" → the first
 * playable board for a brand-new guest (the 30-second lesson; since R2-08 also with the landing demo solved first).
 *
 * Runs against any deployment (production by default for the baseline):
 *   PW_BASE_URL=https://spuzl.vercel.app RUNS=10 PERF_LABEL=r2-baseline \
 *     pnpm exec playwright test tests/perf/r2-baseline.spec.ts --project=perf
 * Writes docs/qa/perf-<label>.json. Every guest it creates is listed in .qa/guests.txt (QA_GUEST_LOG) so the
 * cleanup step (scripts/qa/delete-test-guests.mjs) can remove them afterwards.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { test, type BrowserContext, type Page } from "@playwright/test";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";
import { keepFocus, onboardGuest, pickBirth, solveLandingDemo, tapCell, throttle, VIEWPORTS, waitForBoard } from "../e2e/harness";

const RUNS = Number(process.env.RUNS ?? 10);
const LABEL = process.env.PERF_LABEL ?? "r2-baseline";
const GUESTS = process.env.QA_GUEST_LOG ?? ".qa/guests.txt";
const BOARD = '[role="grid"], [role="listbox"], main[aria-label$=" board"] canvas, main[aria-label$=" board"] button';
const PROFILES = ["desktop", "4g-phone"] as const;
type Profile = (typeof PROFILES)[number];

interface Req {
  name: string;
  type: string;
  start: number;
  end: number;
}
interface Sample {
  ms: number;
  wall: number;
  firstApiMs: number | null;
  todayCalls: number;
  requests: Req[];
  longTasks: { start: number; dur: number }[];
}
const results: Record<string, Sample[]> = {};

/** Long tasks are only reported to observers registered before they happen: start one on every document. */
const LONGTASKS = () => {
  const w = window as unknown as { __lt: { start: number; dur: number }[] };
  w.__lt = [];
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__lt.push({ start: e.startTime, dur: e.duration }))).observe({
      type: "longtask",
      buffered: true,
    });
  } catch {
    /* not supported */
  }
};

async function newCtx(browser: import("@playwright/test").Browser, profile: Profile, state?: string) {
  const ctx = await browser.newContext({
    viewport: profile === "desktop" ? VIEWPORTS.desktop : VIEWPORTS.phone,
    ...(state ? { storageState: state } : {}),
  });
  await ctx.addInitScript(LONGTASKS);
  const page = await ctx.newPage();
  await keepFocus(page);
  if (profile !== "desktop") await throttle(page, "4g");
  return { ctx, page };
}

/** The signed-in user behind a context (a guest), from the Supabase auth cookie; logged for cleanup. */
async function logGuest(ctx: BrowserContext) {
  for (const c of await ctx.cookies()) {
    if (!/^sb-.*-auth-token(\.0)?$/.test(c.name)) continue;
    const raw = decodeURIComponent(c.value).replace(/^base64-/, "");
    try {
      const id = JSON.parse(Buffer.from(raw, "base64").toString("utf8"))?.user?.id;
      if (id) {
        mkdirSync(".qa", { recursive: true });
        appendFileSync(GUESTS, `${id}\n`);
        return id as string;
      }
    } catch {
      /* chunked cookie: the next one has it */
    }
  }
  return null;
}

/**
 * Frame-accurate timing: the page stamps the tap (first click, capture phase) and the first animation frame where
 * `ready` is on screen and enabled. Resource and long-task entries between the two make the waterfall.
 */
async function measure(key: string, page: Page, act: () => Promise<void>, ready = BOARD) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __t0: number; __ready: number };
    w.__ready = 0;
    w.__t0 = 0;
    addEventListener("click", () => (w.__t0 ||= performance.now()), { capture: true, once: true });
    const tick = () => {
      const g = w.__t0 ? document.querySelector(sel) : null;
      const r = g?.getBoundingClientRect();
      if (g && r && r.width > 0 && r.height > 0 && g.getAttribute("aria-disabled") !== "true") w.__ready = performance.now();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ready);
  const t0 = Date.now();
  await act();
  await page.locator(ready).first().waitFor({ state: "visible", timeout: 90_000 });
  const wall = Date.now() - t0;
  const got = await page
    .waitForFunction(() => (window as unknown as { __ready: number }).__ready > 0, null, { timeout: 3000 })
    .then(() =>
      page.evaluate(() => {
        const w = window as unknown as { __t0: number; __ready: number; __lt?: { start: number; dur: number }[] };
        const rel = (x: number) => Math.round(x - w.__t0);
        const requests = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
          .filter((e) => e.startTime >= w.__t0 - 5 && e.startTime <= w.__ready)
          .map((e) => ({ name: new URL(e.name).pathname, type: e.initiatorType, start: rel(e.startTime), end: rel(e.responseEnd) }));
        const longTasks = (w.__lt ?? [])
          .filter((t) => t.start >= w.__t0 && t.start <= w.__ready)
          .map((t) => ({ start: rel(t.start), dur: Math.round(t.dur) }));
        return { ms: Math.round(w.__ready - w.__t0), requests, longTasks };
      }),
    )
    .catch(() => null); // a full document load replaced the page: only the wall time is known
  const requests = got?.requests ?? [];
  const api = requests.filter((r) => r.name.startsWith("/api/"));
  (results[key] ??= []).push({
    ms: got?.ms ?? wall,
    wall,
    firstApiMs: api.length ? Math.min(...api.map((r) => r.start)) : null,
    todayCalls: api.filter((r) => r.name === "/api/v1/today").length,
    requests,
    longTasks: got?.longTasks ?? [],
  });
}

/** Onboards a guest in its own context (warm-up, not timed) and returns its saved session. */
async function guestState(browser: import("@playwright/test").Browser, profile: Profile, file: string) {
  const ctx = await browser.newContext({ viewport: profile === "desktop" ? VIEWPORTS.desktop : VIEWPORTS.phone });
  const page = await ctx.newPage();
  await keepFocus(page);
  await onboardGuest(page, { nickname: `R2b${Date.now() % 1e7}` });
  await logGuest(ctx);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

const HOME_PLAY = 'main a[href^="/play/"]';

for (const profile of PROFILES) {
  test.describe(profile, () => {
    test.describe.configure({ mode: "serial", timeout: 60 * 60_000 });

    test("Home Continue, Library → card → Play, Next level (cold and warm)", async ({ browser }) => {
      for (let i = 0; i < RUNS; i++) {
        const state = await guestState(browser, profile, `test-results/r2-state-${profile}.json`);

        // Home Continue/Play: the first game of the session, then again (warm)
        {
          const { ctx, page } = await newCtx(browser, profile, state);
          await page.goto("/");
          await page.locator(HOME_PLAY).first().waitFor({ timeout: 90_000 });
          await page.waitForTimeout(2000); // a player looks at Home before tapping
          await measure(`${profile}:home-continue:cold`, page, () => page.locator(HOME_PLAY).first().click());
          await page.goto("/");
          await page.locator(HOME_PLAY).first().waitFor({ timeout: 90_000 });
          await page.waitForTimeout(2000);
          await measure(`${profile}:home-continue:warm`, page, () => page.locator(HOME_PLAY).first().click());

          // Next level: solve this Crownfall level, then time "Next level of Crownfall"
          const started = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST", {
            timeout: 90_000,
          });
          await page.goto("/play/crownfall?mode=free");
          const puzzle = (await (await started).json()).puzzle as CrownfallPuzzle;
          await waitForBoard(page, 90_000);
          const sol = solve(puzzle)!;
          for (let r = 0; r < sol.length; r++) {
            await tapCell(page, r + 1, sol[r] + 1);
            await tapCell(page, r + 1, sol[r] + 1);
            if (r === 0) await page.waitForTimeout(7000); // stay above the human floor (no fast-solve flag)
          }
          const next = page.getByRole("button", { name: "Next level of Crownfall" });
          await next.waitFor({ timeout: 60_000 });
          await page.waitForTimeout(800);
          await measure(`${profile}:next-level`, page, () => next.click());
          await ctx.close();
        }

        // Library → card → Play, in a fresh context (cold), then again (warm)
        {
          const { ctx, page } = await newCtx(browser, profile, state);
          for (const k of ["cold", "warm"] as const) {
            await page.goto("/library");
            const row = page.locator('main li button[aria-haspopup="dialog"]').nth(1);
            await row.waitFor({ timeout: 90_000 });
            await page.waitForTimeout(1500);
            await row.click();
            const play = page
              .getByRole("dialog")
              .getByRole("button", { name: /^Play\b|Free play|Today's Daily/ })
              .first();
            await play.waitFor({ timeout: 30_000 });
            await page.waitForTimeout(600);
            await measure(`${profile}:library-play:${k}`, page, () => play.click());
          }
          await ctx.close();
        }
      }
    });

    /**
     * R2-08: "Play now" goes straight to the birth step as a guest (no intro, no second guest/sign-in choice):
     * Play now → birth → start choice → lesson board. With the landing demo solved first, the lesson is skipped and
     * the first board after the start choice is the chosen game (Crownfall, after the nickname). R2-08 target: the
     * unsolved path under 2 000 ms.
     */
    for (const demo of [false, true]) {
      test(`Landing Play now → first playable board (new guest${demo ? ", demo solved" : ""})`, async ({ browser }) => {
        for (let i = 0; i < RUNS; i++) {
          const { ctx, page } = await newCtx(browser, profile);
          await page.goto("/");
          const playNow = page.getByRole("link", { name: "Play now" }).first();
          await playNow.waitFor({ timeout: 90_000 });
          if (demo) await solveLandingDemo(page);
          await page.waitForTimeout(1500);
          // Every step is answered the moment it appears, so the time is the app's, not a person's thinking.
          const t0 = Date.now();
          const steps: Record<string, number> = {};
          const mark = (k: string) => (steps[k] = Date.now() - t0);
          await playNow.click();
          await page.getByRole("heading", { name: /When were you born\?/ }).waitFor({ timeout: 90_000 });
          mark("birth");
          await pickBirth(page);
          const choice = page.getByRole("button", { name: demo ? /Play more Crownfall/ : /Learn a game in 30 seconds/ });
          await choice.waitFor({ timeout: 90_000 });
          mark("start-choice");
          await choice.click();
          if (demo) {
            await page.locator("#nick").fill(`R2d${Date.now() % 1e7}`);
            mark("nickname");
            await page.getByRole("button", { name: "Save my Spuz and play Crownfall" }).click();
            await page.waitForURL((u) => u.pathname === "/play/crownfall", { timeout: 90_000 });
          }
          await page.locator(BOARD).first().waitFor({ state: "visible", timeout: 90_000 });
          mark("board");
          const total = Date.now() - t0;
          const key = demo ? "landing-solved-to-board" : "landing-to-board";
          (results[`${profile}:${key}`] ??= []).push({
            ms: total,
            wall: total,
            firstApiMs: null,
            todayCalls: 0,
            requests: [],
            longTasks: [],
          });
          (results[`${profile}:${demo ? "landing-solved-steps" : "landing-steps"}`] ??= []).push({
            ms: steps.board - steps["start-choice"],
            wall: total,
            firstApiMs: null,
            todayCalls: 0,
            requests: Object.entries(steps).map(([name, end]) => ({ name, type: "step", start: 0, end })),
            longTasks: [],
          });
          await logGuest(ctx);
          await ctx.close();
        }
      });
    }
  });
}

test.afterAll(() => {
  mkdirSync("docs/qa", { recursive: true });
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length - 1) * p))];
  const summary = Object.fromEntries(
    Object.entries(results).map(([k, v]) => {
      const ms = v.map((s) => s.ms);
      const median = [...v].sort((a, b) => a.ms - b.ms)[Math.floor((v.length - 1) / 2)];
      return [
        k,
        {
          runs: v.length,
          p50: pct(ms, 0.5),
          p95: pct(ms, 0.95),
          min: Math.min(...ms),
          max: Math.max(...ms),
          firstApiP50: pct(
            v.map((s) => s.firstApiMs ?? -1),
            0.5,
          ),
          todayCallsMax: Math.max(...v.map((s) => s.todayCalls)),
          // the median run's waterfall, for the report
          waterfall: { requests: median.requests, longTasks: median.longTasks },
        },
      ];
    }),
  );
  writeFileSync(
    `docs/qa/perf-${LABEL}.json`,
    JSON.stringify({ at: new Date().toISOString(), base: process.env.PW_BASE_URL, runs: RUNS, summary }, null, 2),
  );
});
