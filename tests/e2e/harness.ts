/**
 * QA harness for SPUZL end-to-end tests (Playwright). Shared helpers for every spec:
 *
 *   onboardGuest(page, age | opts)     first run as a guest, lands on Home; opts: { age, birthYear, birthMonth,
 *                                      nickname, guided }
 *   keepFocus(page)                    the page always thinks it has focus (games auto-pause on blur)
 *   openGame(page, slug, mode)         /play/<slug>?mode=… and waits for the board
 *   openTestBoard(page, slug, seed, d) seeded, server-free board (/dev/board fixture, deterministic)
 *   solveTestBoard(page, slug, seed)   solves a seeded board by tapping (games with a tap solver below)
 *   hasSolver(slug)                    whether solveTestBoard can play that game
 *   playSeeded(page, slug, seed, d)    plays a seeded board already on screen (a practice round: `tutorial:<id>`)
 *   solveSeeded(page, slug, seed)      alias of solveTestBoard (the R2 brief's name)
 *   seededBoardUrl(slug, seed, d)      the /dev/board URL for any game's deterministic puzzle
 *   tapCell(page, row, col)            taps a grid cell by its accessible name ("Row r, column c, …")
 *   solveLandingDemo(page)             solves the landing page's "Try it" Crownfall (R2-08)
 *   duelVsBot(page)                    starts a Practice-bot Duel
 *   openPartyRoom(page)                opens a Party room, returns its 4-character code
 *   duelFriend(browser, o)             two players in two contexts: host creates a friend duel, guest joins by code
 *   partyRoom(browser, n, o)           n players in n contexts in one Party room (host first)
 *   runAxe(page, o)                    axe-core scan; returns serious/critical violations
 *   throttle(page, profile)            network profile via CDP (Chromium): "4g" | "slow3g" | "offline" | "none"
 *
 * Seeded puzzles come from the game's own generator (same code as the server), so tests never depend on
 * today's Daily. The /dev routes exist only when ENABLE_DEV_ROUTES=1 or outside production.
 */
import { expect, type Browser, type Page } from "@playwright/test";
import { GAMES, LAB_GAMES } from "@/lib/catalog";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
// Static imports: Playwright's loader resolves the "@/" alias only for these, not for runtime import()
import * as crownfall from "@/games/crownfall/logic";
import { TUTORIAL_SOLUTION } from "@/games/crownfall/tutorial";
import * as trotro from "@/games/trotro/logic";
import * as lightup from "@/games/lightup/logic";
import * as killer from "@/games/killer/logic";
import * as dara from "@/games/dara/logic";
import * as quads from "@/games/quads/logic";
import * as daraRules from "@/games/dara/rules";
import * as five from "@/games/five/logic";
import * as hilo from "@/games/hilo/logic";
import * as flagged from "@/games/flagged/logic";
import * as twotruths from "@/games/twotruths/logic";
import { REVEAL_MS as TRUTHS_REVEAL_MS } from "@/games/twotruths/rules";
import * as azonto from "@/games/azonto/logic";
import { MOVE_DEFS as AZONTO_MOVES } from "@/games/azonto/rules";
import { MOVE_NAME as AZONTO_NAME } from "@/lib/copy/azonto";
import { READ_FLOOR_MS } from "@/games/_shared/cluecave";

export type Age = "13-15" | "16-17" | "18+";
/** A birth month and year in each band today (December births are the youngest of their year). */
export function birthFor(age: Age, today = new Date()): { year: number; month: number } {
  const y = today.getUTCFullYear();
  return age === "18+" ? { year: y - 30, month: 1 } : age === "16-17" ? { year: y - 17, month: 12 } : { year: y - 14, month: 12 };
}

/** Where every guest a run creates is listed, for `scripts/qa/delete-test-guests.mjs` (outside test-results, which
 * Playwright clears at the start of each run). */
export const GUEST_LOG = process.env.QA_GUEST_LOG ?? ".qa/guests.txt";

/** Appends the signed-in guest's id to GUEST_LOG. */
export async function logGuest(page: Page) {
  const id = await page
    .evaluate(() => fetch("/api/v1/me?optional=1").then((r) => r.json()))
    .then((m: { id?: string } | null) => m?.id ?? null)
    .catch(() => null);
  if (!id) return null;
  const { appendFileSync, mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(GUEST_LOG), { recursive: true });
  appendFileSync(GUEST_LOG, `${id}\n`);
  return id;
}

/** The onboarding step "When were you born?": picks a birth month and year (a band, or exact values) and continues. */
export async function pickBirth(page: Page, age: Age | { year: number; month?: number } = "18+") {
  const b = typeof age === "string" ? birthFor(age) : { year: age.year, month: age.month ?? 12 };
  await page.getByLabel("Month", { exact: true }).selectOption(String(b.month));
  // R2-09: the year is a 4-digit numeric field (it was a select).
  await page.getByLabel("Year", { exact: true }).fill(String(b.year));
  await page.getByRole("button", { name: /^Continue\b/ }).click();
}

export interface GuestOpts {
  age?: Age;
  /** an exact birth year (e.g. this year − 15 for a 15-year-old with a December birthday); wins over `age` */
  birthYear?: number;
  birthMonth?: number;
  nickname?: string;
  /** keep the guided first play (practice rounds) instead of marking every game learned */
  guided?: boolean;
}

/** Age in whole years today for a birth month and year (the app counts the month as passed at its start). */
export function ageOf(year: number, month = 12, today = new Date()) {
  const y = today.getUTCFullYear() - year;
  return today.getUTCMonth() + 1 >= month ? y : y - 1;
}

export async function onboardGuest(
  page: Page,
  ageOrOpts: Age | GuestOpts = "18+",
  nickname = `Qa${Date.now() % 1e7}`,
  legacy: { guided?: boolean } = {},
) {
  const o: GuestOpts = typeof ageOrOpts === "string" ? { age: ageOrOpts, nickname, ...legacy } : { nickname, ...ageOrOpts };
  nickname = o.nickname ?? nickname;
  await page.goto("/welcome");
  // Most tests go straight to the real game; the guided first play has its own test.
  if (!o.guided)
    await page.evaluate(
      (ids) => localStorage.setItem("spuzl.learned", JSON.stringify(ids)),
      [...GAMES, ...LAB_GAMES].map((g) => g.id),
    );
  await page.getByRole("button", { name: "Play as guest" }).click();
  await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
  await pickBirth(page, o.birthYear ? { year: o.birthYear, month: o.birthMonth } : (o.age ?? "18+"));
  await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
  await page.locator("#nick").fill(nickname);
  await page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await logGuest(page);
  return nickname;
}

/**
 * The board is interactive when its grid (or main board region) is visible and not aria-disabled. Quiz games
 * (Quickfire, Emoji Hits) show only their Start button until play begins: that counts as ready.
 */
export async function waitForBoard(page: Page, timeout = 30_000) {
  const board = page
    .locator('[role="grid"], [role="listbox"], main[aria-label$=" board"] canvas, main[aria-label$=" board"] button')
    .or(page.getByRole("button", { name: /^Start\b/ }))
    .first();
  await board.waitFor({ state: "visible", timeout });
  return board;
}

export async function openGame(page: Page, slug: string, mode: "daily" | "free" = "free") {
  await page.goto(`/play/${slug}?mode=${mode}`);
  return waitForBoard(page);
}

/** The /dev/board fixture URL for any game's deterministic puzzle (same generator as the server). */
export function seededBoardUrl(slug: string, seed = "qa", d: Difficulty = "easy", state?: unknown) {
  const q = new URLSearchParams({ seed, d });
  if (state !== undefined) q.set("state", JSON.stringify(state));
  return `/dev/board/${slug}?${q}`;
}

export async function openTestBoard(page: Page, slug: string, seed = "qa", d: Difficulty = "easy", state?: unknown) {
  await page.goto(seededBoardUrl(slug, seed, d, state));
  return waitForBoard(page);
}

export async function tapCell(page: Page, row: number, col: number) {
  await page
    .getByRole("gridcell", { name: new RegExp(`^Row ${row}, column ${col}\\b`) })
    .first()
    .click();
}

/**
 * R2-08: solves the landing page's playable Crownfall ("Try it", the welcome lesson's fixed 4 × 4 board) by tapping,
 * so "Play now" carries the clear into onboarding. Call on the landing page ("/" for a visitor).
 */
export async function solveLandingDemo(page: Page) {
  for (let r = 0; r < TUTORIAL_SOLUTION.length; r++) {
    await tapCell(page, r + 1, TUTORIAL_SOLUTION[r] + 1);
    await tapCell(page, r + 1, TUTORIAL_SOLUTION[r] + 1);
  }
  await expect(page.getByText(/^Cleared! That's one of/)).toBeVisible();
}

/** Per-game solvers that play the seeded solution through real taps. Extend as games get contract tests. */
const SOLVERS: Record<string, (page: Page, seed: string, d: Difficulty) => Promise<void>> = {
  async crownfall(page, seed, d) {
    const { generate } = crownfall;
    const g = generate(createRng(seed), d);
    // tap mode cycles empty → X → crown, so two taps place a crown
    for (let r = 0; r < g.solution.length; r++) {
      await tapCell(page, r + 1, g.solution[r] + 1);
      await tapCell(page, r + 1, g.solution[r] + 1);
    }
  },
  async trotro(page, seed, d) {
    const { generate, applyMove } = trotro;
    const { puzzle: p, solution } = generate(createRng(seed), d);
    // Tap a cell of the vehicle to select it, then the free cell in its lane where its leading end lands.
    let pos = p.start;
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
  async lightup(page, seed, d) {
    const { generate } = lightup;
    const g = generate(createRng(seed), d);
    // one tap on an empty white cell places a lamp
    for (const i of g.solution.lamps) await tapCell(page, Math.floor(i / g.puzzle.size) + 1, (i % g.puzzle.size) + 1);
  },
  async killer(page, seed, d) {
    const { generate } = killer;
    const g = generate(createRng(seed), d);
    const n = g.puzzle.size;
    const pad = page.getByRole("group", { name: "Number pad" });
    // tap each open cell, then its digit on the pad (named "3, 2 left": the digit, then the count)
    for (let i = 0; i < n * n; i++) {
      if (g.puzzle.givens[i]) continue;
      await tapCell(page, Math.floor(i / n) + 1, (i % n) + 1);
      await pad.getByRole("button", { name: new RegExp(`^${g.solution[i]}\\b`) }).click();
    }
  },
  async five(page, seed, d) {
    // The answer is in the generated puzzle's solution: type it on the physical keyboard, then Enter.
    const g = five.generate(createRng(seed), d);
    await page.keyboard.type(g.solution.answer.toLowerCase());
    await page.keyboard.press("Enter");
  },
  async hilo(page, seed, d) {
    const g = hilo.generate(createRng(seed), d);
    for (let i = 0; i < hilo.CALLS; i++) {
      const call = hilo.answer(g.solution.values, i);
      await page.getByRole("button", { name: call === "hi" ? /^Higher:/ : /^Lower:/ }).click();
      // Each call's pip turns "right" before the next card is in play.
      await expect(page.locator(`[aria-label="Call ${i + 1}: right"]`)).toHaveCount(1);
    }
  },
  async flagged(page, seed, d) {
    const g = flagged.generate(createRng(seed), d);
    const total = g.solution.correct.length;
    await page.getByRole("button", { name: /^Start\b/ }).click();
    const answers = page.getByRole("group", { name: "Answers" });
    for (let i = 0; i < total; i++) {
      // Taps before the reading floor are ignored, and the next round follows the last one's reveal (1.1 s).
      await page.waitForTimeout((i ? 1100 : 0) + READ_FLOOR_MS + 200);
      await answers.getByRole("button", { name: new RegExp(`^${"ABCD"[g.solution.correct[i]]}, `) }).click();
      await expect(page.getByRole("img", { name: `${i + 1} of ${total} answered` })).toBeVisible();
    }
  },
  async twotruths(page, seed, d) {
    // The practice round (seed `tutorial:twotruths`) is the game's own practice board, not a seeded one.
    const g = seed === "tutorial:twotruths" ? twotruths.practice() : twotruths.generate(createRng(seed), d);
    const total = g.solution.lie.length;
    await page.getByRole("button", { name: /^Start\b/ }).click();
    const answers = page.getByRole("group", { name: "Answers" });
    for (let i = 0; i < total; i++) {
      // Taps before the reading floor are ignored; the next round follows the reveal (what is true instead).
      await page.waitForTimeout((i ? TRUTHS_REVEAL_MS : 0) + READ_FLOOR_MS + 200);
      await answers.getByRole("button", { name: new RegExp(`^${"ABC"[g.solution.lie[i]]}, `) }).click();
      await expect(page.getByRole("img", { name: `${i + 1} of ${total} answered` })).toBeVisible();
    }
  },
  async azonto(page, seed, d) {
    // The practice round is the game's own short dance, played in full; a seeded board plays two rounds, then a
    // deliberate wrong move ends the run (a run counts once it is over).
    const practice = seed === "tutorial:azonto";
    const p = practice ? azonto.practice().puzzle : azonto.generate(createRng(seed), d).puzzle;
    const pad = page.getByRole("group", { name: "Azonto moves" });
    const move = (m: number) => pad.getByRole("button", { name: new RegExp(`^${AZONTO_NAME[AZONTO_MOVES[m].id]},`) });
    await page.getByRole("button", { name: /^Start\b/ }).click();
    const rounds = practice ? p.seq.length - p.start + 1 : 2;
    for (let r = 0; r < rounds; r++) {
      // Spuz dances the round first; the pad opens when it is your turn.
      await expect(move(0)).toBeEnabled({ timeout: 30_000 });
      for (let k = 0; k < p.start + r; k++) {
        await move(p.seq[k]).click();
        // the server's human floor between moves is 100 ms
        await page.waitForTimeout(160);
      }
      // the round is repeated: the pad closes while Spuz dances the next one
      if (r < rounds - 1 || !practice) await expect(move(0)).toBeDisabled();
    }
    if (!practice) {
      await expect(move(0)).toBeEnabled({ timeout: 30_000 });
      await move((p.seq[0] + 1) % AZONTO_MOVES.length).click();
    }
  },
  async quads(page, seed, d) {
    const { generate } = quads;
    const g = generate(createRng(seed), d);
    await quadsSolveGroups(
      page,
      g.solution.groups.map((x) => x.words),
    );
  },
  async dara(page, seed, d) {
    const { generate, replay } = dara;
    const { steps } = daraRules;
    const g = generate(createRng(seed), d);
    const cell = (i: number) => tapCell(page, Math.floor(i / 6) + 1, (i % 6) + 1);
    const { from, to, takes } = g.solution;
    await cell(from);
    await cell(to);
    if (g.puzzle.goal === "three2") {
      // their reply plays at once; then step into the three it leaves
      const fin = steps(replay(g.puzzle, [{ from, to }]).board, 1).find((s) => s.three)!;
      await cell(fin.from);
      await cell(fin.to);
    }
    if (takes.length) await cell(takes[0]);
    else
      await page
        .getByRole("gridcell", { name: /can be taken/ })
        .first()
        .click();
  },
};

/** Quads tile for a word (named "WORD", "WORD, lifted", …). */
export const quadsTile = (page: Page, w: string) => page.getByRole("option", { name: new RegExp(`^${w}(,|$)`) });

/**
 * Lifts each group's four words and presses Submit, waiting for the board's answer (data-feedback-n) each time.
 * Used by the Quads solver, the practice round and the R2-14 spec.
 */
export async function quadsSolveGroups(page: Page, groups: string[][]) {
  const board = page.locator("[data-feedback-n]");
  for (const words of groups) {
    const n = Number((await board.getAttribute("data-feedback-n")) ?? 0);
    for (const w of words) await quadsTile(page, w).click();
    await page.getByRole("button", { name: /^Submit/ }).click();
    await expect(board).toHaveAttribute("data-feedback-n", String(n + 1), { timeout: 15_000 });
  }
}

export async function solveTestBoard(page: Page, slug: string, seed = "qa", d: Difficulty = "easy") {
  const solve = SOLVERS[slug];
  if (!solve) throw new Error(`no tap solver for ${slug} yet`);
  await openTestBoard(page, slug, seed, d);
  await solve(page, seed, d);
}

/** Whether solveTestBoard has a tap solver for the game. */
export const hasSolver = (slug: string) => Object.hasOwn(SOLVERS, slug);

/**
 * Plays a seeded board that is already on screen through the game's solver, without opening the fixture: e.g. a
 * practice round, whose board is the easy board from seed `tutorial:<id>` (lib/game/service.ts guidedSeed).
 */
export async function playSeeded(page: Page, slug: string, seed: string, d: Difficulty = "easy") {
  const solve = SOLVERS[slug];
  if (!solve) throw new Error(`no tap solver for ${slug} yet`);
  await solve(page, seed, d);
}

/** The R2 brief's name for solveTestBoard. */
export const solveSeeded = solveTestBoard;

/** Every game a player can open (and the lab ones behind the flag): the list seeded-board smoke tests walk. */
export const ALL_SLUGS = [...GAMES, ...LAB_GAMES].map((g) => g.id);

export async function duelVsBot(page: Page) {
  // no game is picked by default any more: come in with one chosen
  await page.goto("/duel?game=sixer");
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

/**
 * Games pause when the window loses focus (blur/visibilitychange). Headless and multi-context runs blur pages that
 * aren't in front, so tell Chromium every page is focused and visible.
 */
export async function keepFocus(page: Page) {
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  } catch {
    /* not Chromium */
  }
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
    Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
    document.hasFocus = () => true;
  });
}

/** A signed-in guest in its own browser context (focused), for multi-player tests. */
export async function guestContext(browser: Browser, o: GuestOpts & { viewport?: { width: number; height: number } } = {}) {
  const ctx = await browser.newContext({ viewport: o.viewport ?? VIEWPORTS.phone });
  const page = await ctx.newPage();
  await keepFocus(page);
  const nickname = await onboardGuest(page, o);
  return { ctx, page, nickname };
}

/**
 * Friend duel between two contexts: the host opens Duel, picks `game` (default Sixer) and Challenge a friend; the
 * guest joins with the code. Returns both pages on the duel screen. Ages via `host`/`guest` options.
 */
export async function duelFriend(browser: Browser, o: { game?: string; host?: GuestOpts; guest?: GuestOpts } = {}) {
  const a = await guestContext(browser, o.host);
  const b = await guestContext(browser, o.guest);
  await a.page.goto(`/duel?game=${o.game ?? "sixer"}`);
  await a.page
    .getByRole("button", { name: /Challenge a friend/ })
    .first()
    .click();
  const code = (await a.page
    .getByText(/^[A-Z0-9]{4}$/)
    .first()
    .textContent({ timeout: 30_000 }))!.trim();
  await b.page.goto("/duel");
  await b.page
    .getByRole("button", { name: /Got a friend's code\?/ })
    .first()
    .click();
  await b.page.locator("#join-code").fill(code);
  await b.page.locator("#join-code").press("Enter");
  return { host: a, guest: b, code };
}

/** A Party room with n players in n contexts (host first). Returns the code and every player. */
export async function partyRoom(browser: Browser, n: number, o: { host?: GuestOpts; guests?: GuestOpts } = {}) {
  const host = await guestContext(browser, o.host);
  const code = await openPartyRoom(host.page);
  const players = [host];
  for (let i = 1; i < n; i++) {
    const g = await guestContext(browser, o.guests);
    await g.page.goto(`/party/${code}`);
    await g.page.getByRole("button", { name: /^Join$/ }).click();
    players.push(g);
  }
  await expect(host.page.getByText(new RegExp(`${n}\\s*(/|of)`)).first())
    .toBeVisible({ timeout: 30_000 })
    .catch(() => undefined); // lobby count wording varies; joining is checked by each spec
  return { code, players };
}

/** axe-core scan of the page (WCAG 2.1 AA). Returns serious and critical violations only. */
export async function runAxe(page: Page, o: { include?: string; exclude?: string[] } = {}) {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  let b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (o.include) b = b.include(o.include);
  for (const x of o.exclude ?? []) b = b.exclude(x);
  const r = await b.analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
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
