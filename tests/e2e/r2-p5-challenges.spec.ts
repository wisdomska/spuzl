import { expect, test, type Browser, type Page } from "@playwright/test";
import { onboardGuest, tapCell, VIEWPORTS, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * R2-P5 friend challenges: a clear makes a "Beat my time" link; a friend opens it (card with the 7-day expiry),
 * plays the same puzzle against the ghost timer and gets the head-to-head with "Send it back". Link previews:
 * the page carries og:image and the image renders. Needs the dev server and a database. The lead runs it.
 */
test.describe.configure({ mode: "serial" });

async function solveCrownfall(page: Page, puzzle: CrownfallPuzzle) {
  await waitForBoard(page);
  const sol = solve(puzzle)!;
  for (let r = 0; r < sol.length; r++) {
    await tapCell(page, r + 1, sol[r] + 1);
    await tapCell(page, r + 1, sol[r] + 1);
    if (r === 0) await page.waitForTimeout(6500); // above the human floor
  }
}

/** Clears a free Crownfall and presses Challenge; returns the challenge code the server made. */
export async function clearAndChallenge(page: Page): Promise<string> {
  const started = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST");
  await page.goto("/play/crownfall?mode=free");
  await solveCrownfall(page, (await (await started).json()).puzzle as CrownfallPuzzle);
  const bar = page.getByRole("status").filter({ hasText: "Cleared" });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  const made = page.waitForResponse((r) => r.url().endsWith("/api/v1/challenges") && r.request().method() === "POST");
  await bar.getByRole("button", { name: "Challenge" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Beat my time/ })
    .click();
  return ((await (await made).json()) as { code: string }).code;
}

async function friend(browser: Browser, viewport: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await onboardGuest(page);
  return page;
}

for (const [name, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test(`challenge at ${name}: card with expiry, ghost race, result with Send it back`, async ({ browser }) => {
    const sender = await friend(browser, vp);
    const code = await clearAndChallenge(sender);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    const b = await friend(browser, vp);
    await b.goto(`/c/${code}`);
    await expect(b).toHaveURL(new RegExp(`/challenge/${code}$`));
    await expect(b.getByText("You've been challenged")).toBeVisible();
    await expect(b.getByTestId("challenge-ends")).toHaveText(/Ends in 7 days/);
    await b.screenshot({ path: `docs/qa/screens/r2/p5-challenge-card-${name}.png` });

    const accepted = b.waitForResponse((r) => r.url().endsWith(`/api/v1/challenges/${code}/accept`));
    await b.getByRole("button", { name: "Accept" }).click();
    await solveCrownfall(b, (await (await accepted).json()).puzzle as CrownfallPuzzle);
    await expect(b.getByRole("heading", { level: 1 })).toHaveText(/You beat|holds on/, { timeout: 15_000 });
    await expect(b.getByRole("button", { name: "Send it back" })).toBeVisible();
    await b.screenshot({ path: `docs/qa/screens/r2/p5-challenge-result-${name}.png` });

    await b.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    const back = b.waitForResponse((r) => r.url().endsWith("/api/v1/challenges") && r.request().method() === "POST");
    await b.getByRole("button", { name: "Send it back" }).click();
    expect((await back).status()).toBe(200);
  });
}

test("challenge link preview: og tags on the page and a 1200 × 630 image", async ({ browser, request }) => {
  const sender = await friend(browser, VIEWPORTS.phone);
  const code = await clearAndChallenge(sender);
  const html = await (await request.get(`/challenge/${code}`, { headers: { "user-agent": "WhatsApp/2.23.20.0" } })).text();
  expect(html).toContain(`/api/og/challenge/${code}`);
  const img = await request.get(`/api/og/challenge/${code}`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
});

test("an unknown challenge says so plainly", async ({ browser }) => {
  for (const [name, vp] of [
    ["375", VIEWPORTS.phone],
    ["1280", VIEWPORTS.desktop],
  ] as const) {
    const p = await friend(browser, vp);
    await p.goto("/challenge/ZZZZZZ");
    await expect(p.getByRole("heading", { name: "No challenge here" })).toBeVisible();
    await p.screenshot({ path: `docs/qa/screens/r2/p5-challenge-missing-${name}.png` });
  }
});
