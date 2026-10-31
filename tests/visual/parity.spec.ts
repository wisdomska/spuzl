import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Visual parity against the design handoff (tests/visual/reference, 390 × 844 frames).
 *
 * Live screens carry real data, so a pixel diff against the mock-filled design frames is meaningless.
 * Each screen is instead captured next to its design frame as a side-by-side attachment for review
 * (open the HTML report), and the test asserts what must always hold: the screen renders, has no
 * horizontal overflow at phone width, and logs no errors.
 *
 *   pnpm build && pnpm start -p 3400
 *   PW_BASE_URL=http://localhost:3400 pnpm test:visual --project=mobile-dark
 */
const REF = path.join(__dirname, "reference");
const PAIRS: [route: string, reference: string][] = [
  ["/", "spuzl-solo-screens__02-home-map"],
  ["/world/logic", "spuzl-solo-screens__03-world-view"],
  ["/play/crownfall?mode=free", "spuzl-solo-screens__04-game-crownfall"],
  ["/leaderboards", "spuzl-social-and-meta__s1-leaderboards"],
  ["/me", "spuzl-social-and-meta__s2-profile"],
  ["/quests", "spuzl-social-and-meta__s4-quests"],
  ["/shop", "spuzl-social-and-meta__s5-shop"],
  ["/friends", "spuzl-social-and-meta__f1-friends"],
  ["/crews", "spuzl-social-and-meta__c1-crew"],
  ["/settings", "spuzl-social-and-meta__k1-settings"],
  ["/archive", "spuzl-social-and-meta__k2-archive"],
];

test.describe.configure({ mode: "serial" });
test.skip(({ viewport }) => (viewport?.width ?? 0) > 500, "design frames are phone-sized");

let context: BrowserContext;
let page: Page;
const errors: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Resource failures are checked by URL below (the console line has none); vibrate() is blocked before a tap.
    if (m.type() === "error" && !/vibrate|Failed to load resource|MIME type \('text\/plain'\)/.test(m.text())) errors.push(m.text());
  });
  page.on("response", (r) => {
    // local builds have no /_vercel analytics endpoints; anything else failing is a real error
    if (r.status() >= 400 && !new URL(r.url()).pathname.startsWith("/_vercel/")) errors.push(`${r.status()} ${r.url()}`);
  });
  // First run: age gate, the start choice (tutorial), the 4 × 4 tutorial board, nickname.
  await page.goto("/welcome");
  await page.getByRole("radio", { name: /18 or older/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Show me how/ }).click();
  for (const [r, c] of [
    [0, 1],
    [1, 3],
    [2, 0],
    [3, 2],
  ]) {
    const cell = page.locator(`[data-i="${r * 4 + c}"]`);
    await cell.click();
    await cell.click();
  }
  await page.getByRole("button", { name: "Make it official" }).click();
  await page.locator("#nick").fill(`Vis${Date.now() % 100000}`);
  await page.getByRole("button", { name: "Enter The Grid" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 20_000 });
});

test.afterAll(async () => context?.close());

for (const [route, reference] of PAIRS) {
  test(`${route} beside ${reference}`, async ({}, info) => {
    errors.length = 0;
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600); // entrance motion settles
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "horizontal overflow").toBeLessThanOrEqual(0);
    const ours = await page.screenshot();
    const design = readFileSync(path.join(REF, `${reference}.png`));
    const sheet = await context.newPage();
    await sheet.setViewportSize({ width: 820, height: 884 });
    const src = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
    await sheet.setContent(
      `<body style="margin:0;background:#222;color:#fff;font:12px sans-serif;display:flex;gap:20px;padding:10px">` +
        `<figure style="margin:0"><figcaption>Design: ${reference}</figcaption><img width="390" src="${src(design)}"></figure>` +
        `<figure style="margin:0"><figcaption>Live: ${route}</figcaption><img width="390" src="${src(ours)}"></figure></body>`,
    );
    await info.attach(`${reference} vs live`, { body: await sheet.screenshot(), contentType: "image/png" });
    await sheet.close();
    expect(errors, "console errors").toEqual([]);
  });
}
