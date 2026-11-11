import { expect, test, type Page } from "@playwright/test";
import { onboardGuest } from "./harness";
import { GAMES, WORLD_BY_ID } from "@/lib/catalog";

/**
 * SEO and GEO: the public pages give search engines, AI crawlers and first-time visitors real content without a
 * session (one h1, a canonical, a description, JSON-LD, enough words to answer from), and a signed-in guest still
 * gets the normal Home at "/". Every visitor test runs in a fresh context with no session cookie.
 */
/** The canonical is absolute (metadataBase); the host is the build's NEXT_PUBLIC_SITE_URL, so only the path is pinned. */
const canonicalRe = (path: string) => new RegExp(`^https?://[^/]+${path === "/" ? "" : path.replace(/[/]/g, "\\/")}/?$`);

async function visit(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), path).toBe(200);
  return res!;
}

async function expectSeo(page: Page, path: string, canonical: string, minWords = 0) {
  await expect(page.locator("h1"), `${path}: one h1`).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute("href", canonicalRe(canonical));
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description?.length ?? 0, `${path}: description`).toBeGreaterThan(50);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.length, `${path}: JSON-LD`).toBeGreaterThan(0);
  for (const s of ld) expect(() => JSON.parse(s), path).not.toThrow();
  if (minWords) {
    const words = await page
      .locator("main")
      .evaluate((el) => (el as HTMLElement).innerText.split(/\s+/).filter((w) => /\w/.test(w)).length);
    expect(words, `${path}: words`).toBeGreaterThanOrEqual(minWords);
  }
  return ld.map((s) => JSON.parse(s) as Record<string, unknown>);
}

const types = (docs: Record<string, unknown>[]) =>
  docs.flatMap((d) => ((d["@graph"] as Record<string, unknown>[] | undefined) ?? [d]).map((n) => n["@type"] as string));

test.describe("visitors and crawlers (no session)", () => {
  test("/ is the landing page: h1, Play now, the game catalogue, FAQ and site JSON-LD", async ({ page }) => {
    await visit(page, "/");
    const ld = await expectSeo(page, "/", "/", 250);
    expect(types(ld)).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebApplication", "FAQPage"]));
    await expect(page.getByRole("link", { name: "Play now" }).first()).toHaveAttribute("href", "/welcome/play");
    for (const g of GAMES) await expect(page.locator(`main a[href="/games/${g.id}"]`).first(), g.id).toBeAttached();
    await expect(page.getByRole("heading", { name: "Is SPUZL free?" })).toBeVisible();
  });

  test("/ answers crawlers that send no text/html Accept header", async ({ request }) => {
    const res = await request.get("/", {
      headers: { accept: "*/*", "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2)" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("<h1");
    expect(html).toContain('"@type":"WebApplication"');
  });

  test("/games/crownfall: the game page with VideoGame, breadcrumbs and FAQ", async ({ page }) => {
    await visit(page, "/games/crownfall");
    const ld = await expectSeo(page, "/games/crownfall", "/games/crownfall", 250);
    expect(types(ld)).toEqual(expect.arrayContaining(["VideoGame", "BreadcrumbList", "FAQPage"]));
    await expect(page.getByRole("heading", { level: 1, name: "Crownfall" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Play Crownfall free" }).first()).toHaveAttribute("href", "/play/crownfall");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/games\/crownfall\/opengraph-image/);
    const og = await page.request.get("/games/crownfall/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
  });

  test("/games lists every live game (the graduated lab games too); an unknown or retired game is a 404", async ({ page }) => {
    await visit(page, "/games");
    await expectSeo(page, "/games", "/games");
    for (const g of GAMES) await expect(page.locator(`main a[href="/games/${g.id}"]`).first(), g.id).toBeAttached();
    expect((await page.request.get("/games/nope")).status()).toBe(404);
    expect((await page.request.get("/games/five")).status()).toBe(200);
    expect((await page.request.get("/games/blackout")).status()).toBe(404);
  });

  test("/world/word: the public world page links its games; unknown worlds are a real 404", async ({ page }) => {
    await visit(page, "/world/word");
    await expectSeo(page, "/world/word", "/world/word");
    await expect(page.getByRole("heading", { level: 1, name: WORLD_BY_ID.word.name })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    for (const g of GAMES.filter((x) => x.world === "word"))
      await expect(page.locator(`main a[href="/games/${g.id}"]`).first()).toBeAttached();
    expect((await page.request.get("/world/puzzles")).status()).toBe(404);
    const folded = await page.request.get("/world/rage", { maxRedirects: 0 });
    expect(folded.status()).toBe(308);
  });

  test("/library has its own title, description and canonical", async ({ page }) => {
    await visit(page, "/library");
    await expect(page).toHaveTitle(/All games/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonicalRe("/library"));
  });

  test("/llms.txt lists every live game as plain text", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const text = await res.text();
    expect(text.startsWith("# SPUZL\n")).toBe(true);
    for (const g of GAMES) expect(text, g.id).toContain(`/games/${g.id})`);
    expect((await request.get("/llms-full.txt")).status()).toBe(200);
  });

  test("robots.txt welcomes AI crawlers and keeps private pages out; the sitemap lists the game pages", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(robots).toContain(`User-Agent: ${bot}`);
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const g of GAMES) expect(sitemap, g.id).toContain(`/games/${g.id}</loc>`);
    expect(sitemap).not.toContain("/world/rage<");
  });
});

test("a signed-in guest still gets the normal Home at /", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/");
  // Home's Play card and map, not the landing page.
  await expect(page.getByRole("link", { name: /^(Play|Continue:) / }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Play now" })).toHaveCount(0);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});
