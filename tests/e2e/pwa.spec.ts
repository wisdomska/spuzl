import { expect, test } from "@playwright/test";
import { admin } from "../api/helpers";

/** The offline Daily pack only runs while Dailies are on: switch them on for this file, then restore. */
let dailiesBefore: unknown;
const setDailies = (value: unknown) => admin().from("game_settings").upsert({ key: "features.dailies", value }, { onConflict: "key" });
test.beforeAll(async () => {
  dailiesBefore = (await admin().from("game_settings").select("value").eq("key", "features.dailies").maybeSingle()).data?.value;
  await setDailies(true);
});
test.afterAll(async () => {
  if (dailiesBefore === undefined) await admin().from("game_settings").delete().eq("key", "features.dailies");
  else await setDailies(dailiesBefore);
});

/**
 * Installable PWA: manifest, service worker, offline app shell and today's Dailies prefetch.
 * The worker only registers in production builds (`pnpm build && pnpm start`), so this skips on `next dev`.
 */
test("manifest is installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: "SPUZL", display: "standalone", start_url: expect.stringMatching(/^\//) });
  const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
  for (const i of m.icons) {
    const icon = await request.get(i.src);
    expect(icon.headers()["content-type"]).toBe("image/png");
  }
});

test("works offline: app shell and prefetched Dailies", async ({ page, context }) => {
  await page.goto("/dev/pwa");
  const controlled = await page
    .waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!controlled, "service worker registers in production builds only");

  // A player with a profile, so the prefetch can start today's Dailies.
  await page.getByTestId("setup").click();
  await expect(page.getByTestId("log")).toContainText("Ready", { timeout: 20_000 });
  await page.evaluate(() => localStorage.removeItem("spuzl.prefetch"));
  await page.goto("/"); // caches the shell and runs the prefetch when idle
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const day = new Date().toISOString().slice(0, 10);
          const c = await caches.open(`spuzl-daily-${day}`);
          return (await c.keys()).length;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/SPUZL/);

  const offlineStart = await page.evaluate(async () => {
    const r = await fetch("/api/v1/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "crownfall", mode: "daily" }),
    });
    const body = await r.json();
    return { status: r.status, offline: r.headers.get("x-spuzl-offline"), hasPuzzle: !!body.puzzle, attemptId: body.attemptId };
  });
  expect(offlineStart).toMatchObject({ status: 200, offline: "1", hasPuzzle: true });
  expect(offlineStart.attemptId).toBeTruthy();

  // A page never visited still opens: the cached shell or the offline page, never the browser error.
  const res = await page.goto("/never-visited-page");
  expect(res?.status()).toBeLessThan(600);
  await expect(page.locator("body")).toContainText(/offline|SPUZL|Grid/i);
  await context.setOffline(false);
});
