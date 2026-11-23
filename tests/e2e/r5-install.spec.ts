import { devices, expect, test, type Page } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * Installing SPUZL (owner, 23 Nov 2026, the features Clink has): the install guide for the device, the one-tap
 * Install where the browser offers it, the Settings row, the installed app skipping the landing page, the count on
 * the app icon, the worker's navigation preload and the single-colour notification badge. Production build (the
 * worker only runs there).
 */

/** The browser's one-time install offer, as Chrome sends it; `window.__prompted` records the tap. */
async function offerInstall(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
  await page.evaluate((o) => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
    e.prompt = async () => void ((window as unknown as { __prompted: boolean }).__prompted = true);
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);
}

test.describe("on an iPhone", () => {
  test.use({ userAgent: devices["iPhone 15"].userAgent, viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });
  test("the guide shows Safari's steps: Share, then Add to Home Screen", async ({ page }) => {
    await page.goto("/install");
    await expect(page.getByRole("heading", { name: "Put SPUZL on your home screen" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "iPhone" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("list", { name: "Steps" })).toContainText("Tap Share, then Add to Home Screen");
    await expect(page.getByRole("button", { name: "Install SPUZL now" })).toHaveCount(0);
  });
});

test.describe("on Android", () => {
  test.use({ userAgent: devices["Pixel 7"].userAgent, viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true });
  test("Chrome's steps, then a one-tap Install once the browser offers it", async ({ page }) => {
    await page.goto("/install");
    await expect(page.getByRole("radio", { name: "Android" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("list", { name: "Steps" })).toContainText("Install app");
    await offerInstall(page);
    await page.getByRole("button", { name: "Install SPUZL now" }).click();
    expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
    await expect(page.getByText("SPUZL is on your home screen.")).toBeVisible();
  });

  test("Settings: How to, then Install when the browser offers it", async ({ page }) => {
    test.setTimeout(120_000);
    await onboardGuest(page);
    await page.goto("/settings");
    const row = page.getByText("Add to your home screen");
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "How to", exact: true })).toHaveAttribute("href", "/install");
    await offerInstall(page);
    await page.getByRole("button", { name: "Install", exact: true }).click();
    await expect(page.getByText("On your home screen")).toBeVisible();
  });
});

test.describe("opened from the home screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("with no account yet, it opens on the app (welcome), not the website's landing page", async ({ page }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q === "(display-mode: standalone)" ? ({ ...real(q), matches: true, media: q } as MediaQueryList) : real(q);
    });
    await page.goto("/?source=pwa");
    await page.waitForURL((u) => u.pathname === "/intro" || u.pathname.startsWith("/welcome"), { timeout: 30_000 });
  });

  test("in a browser tab, a visitor still gets the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("SPUZL");
    await page.waitForTimeout(1000);
    expect(new URL(page.url()).pathname).toBe("/");
  });
});

test.describe("the installed app", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("Home puts its count on the app icon (none waiting: cleared)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      const calls: string[] = [];
      (window as unknown as { __badge: string[] }).__badge = calls;
      Object.assign(navigator, {
        setAppBadge: async (n?: number) => void calls.push(`set:${n}`),
        clearAppBadge: async () => void calls.push("clear"),
      });
    });
    await onboardGuest(page);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __badge: string[] }).__badge), { timeout: 30_000 })
      .toContainEqual(expect.stringMatching(/^(clear|set:\d+)$/));
  });

  test("the worker starts page loads early (navigation preload), and alerts carry a single-colour badge", async ({ page }) => {
    await page.goto("/about");
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      // Preload is switched on while the worker activates: wait until it has finished activating.
      for (let i = 0; i < 100 && reg.active?.state !== "activated"; i++) await new Promise((r) => setTimeout(r, 100));
      return reg.navigationPreload ? (await reg.navigationPreload.getState()).enabled : null;
    });
    expect(state).toBe(true);
    // The badge icon: white where it's drawn, see-through elsewhere (Android shows it as a mark in the status bar).
    const px = await page.evaluate(async () => {
      const img = new Image();
      img.src = "/icons/badge-96.png";
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0,
        notWhite = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3] > 200) {
          opaque++;
          if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) notWhite++;
        }
      return { w: img.width, h: img.height, opaque, notWhite };
    });
    expect(px).toMatchObject({ w: 96, h: 96, notWhite: 0 });
    expect(px.opaque).toBeGreaterThan(1500);
  });
});
