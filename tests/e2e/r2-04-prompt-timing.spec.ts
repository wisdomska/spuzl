import { test, expect, type Page } from "@playwright/test";
import { onboardGuest, throttle } from "./harness";

/**
 * R2-04 prompt timing: the notification ask only after a trigger and never on Home, at most once per cooldown;
 * the low-data suggestion only after measured slow loads, once a session; never two prompts on one screen.
 *
 * Prompts carry `data-prompt="<id>"` (alerts, low_data, save_streak, event). Headless Chromium's notification
 * permission varies by build, so most tests pin it to "default" (what a real first-time visitor has) with
 * `notificationsDefault`; one test grants it for real with `context.grantPermissions`.
 * Needs the app with a database and default game settings (prompts.*).
 */

const DAY = 24 * 3600_000;
const ALERTS = '[data-prompt="alerts"]';
const LOW_DATA = '[data-prompt="low_data"]';
/** The queue waits 800 ms for a screen to settle; give a prompt that should NOT show well past that. */
const QUIET_WAIT = 2500;

async function notificationsDefault(page: Page) {
  await page.addInitScript(() => {
    const N = (window as unknown as { Notification?: typeof Notification }).Notification;
    if (!N) return;
    const w = window as unknown as { __perm?: NotificationPermission };
    Object.defineProperty(N, "permission", { configurable: true, get: () => w.__perm ?? "default" });
    N.requestPermission = async () => (w.__perm = "denied");
  });
}

/** Records the most prompts ever on screen at once (window.__maxPrompts). */
async function countPrompts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __maxPrompts: number };
    w.__maxPrompts = 0;
    const check = () => {
      const n = [...document.querySelectorAll("[data-prompt]")].filter((el) => (el as HTMLElement).offsetParent !== null).length;
      if (n > w.__maxPrompts) w.__maxPrompts = n;
    };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
    setInterval(check, 100);
  });
}
const maxPrompts = (page: Page) => page.evaluate(() => (window as unknown as { __maxPrompts: number }).__maxPrompts);

/** Records an alerts trigger on this device, as the app would (first friend, first invite, a streak). */
async function fireTrigger(page: Page, trigger: "friend" | "invite" | "streak") {
  await page.evaluate((t) => {
    const s = JSON.parse(localStorage.getItem("spuzl.alertsAsk") ?? '{"fired":{},"lastAskAt":0}');
    s.fired[t] = Date.now();
    localStorage.setItem("spuzl.alertsAsk", JSON.stringify(s));
    window.dispatchEvent(new Event("spuzl:alerts-ask"));
  }, trigger);
}

/** Pretends this session measured `n` slow loads in a row (what PromptHost records). */
async function slowLoads(page: Page, n = 2) {
  await page.evaluate((count) => {
    sessionStorage.setItem("spuzl.loads", JSON.stringify(Array.from({ length: count }, () => 9000)));
    window.dispatchEvent(new Event("spuzl:loads"));
  }, n);
}

/** An in-app link click (a client-side navigation, so the prompt queue sees a new screen visit). */
async function clickTo(page: Page, href: string) {
  await page.locator(`a[href="${href}"]:visible`).first().click();
  await page.waitForURL((u) => u.pathname === href);
}

test.describe("notification ask (R2-04)", () => {
  test("a new guest sees no notification prompt on first Home, nor anywhere without a trigger", async ({ page }) => {
    await notificationsDefault(page);
    await onboardGuest(page, "18+");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);
    await page.goto("/library");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);
  });

  test("a real friend accept between two contexts earns the ask once, never on Home", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pa = await a.newPage();
    const pb = await b.newPage();
    await notificationsDefault(pa);
    await notificationsDefault(pb);
    await onboardGuest(pa, "18+");
    const bNick = await onboardGuest(pb, "18+");

    // A asks, B accepts (the same calls the Friends screen makes).
    const sent = await pa.evaluate(
      (nickname) =>
        fetch("/api/v1/friends", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nickname }),
        }).then((r) => r.status),
      bNick,
    );
    expect(sent).toBe(200);
    await pb.goto("/friends");
    await pb.waitForTimeout(QUIET_WAIT);
    await expect(pb.locator(ALERTS)).toHaveCount(0); // a request alone is not a friend yet
    await pb
      .getByRole("button", { name: /^Accept / })
      .first()
      .click();

    // B: the accept is the trigger; the ask shows right there, once.
    await expect(pb.locator(ALERTS)).toBeVisible();
    await pb.getByRole("dialog", { name: "Turn on alerts" }).getByRole("button", { name: "Not now" }).click();
    await expect(pb.locator(ALERTS)).toHaveCount(0);
    for (const p of ["/", "/me", "/leagues"]) {
      await pb.goto(p);
      await pb.waitForTimeout(QUIET_WAIT);
      await expect(pb.locator(ALERTS)).toHaveCount(0);
    }

    // A (the requester) learns from the friends list the server sends.
    await pa.goto("/friends");
    await expect(pa.locator(ALERTS)).toBeVisible({ timeout: 15_000 });
    await a.close();
    await b.close();
  });

  test("shows once after a trigger; after Not now, not again within 7 days (fake clock)", async ({ page }) => {
    await page.clock.install({ time: new Date() });
    await notificationsDefault(page);
    await onboardGuest(page, "18+");
    await fireTrigger(page, "friend");

    // Home never asks (first visit or not): the Continue card is there.
    await page.goto("/");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);
    await page.goto("/library");
    await expect(page.locator(ALERTS)).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.locator(ALERTS)).toHaveCount(0);

    // A new trigger the next day: still inside the cooldown.
    const asked = Date.now();
    await page.clock.setSystemTime(asked + DAY);
    await fireTrigger(page, "invite");
    await page.goto("/me");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);

    await page.clock.setSystemTime(asked + 6.5 * DAY);
    await page.goto("/shop");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);

    await page.clock.setSystemTime(asked + 7.5 * DAY);
    await page.goto("/leagues");
    await expect(page.locator(ALERTS)).toBeVisible();
  });

  test("never during play, and never once notifications are allowed", async ({ page, context }) => {
    await notificationsDefault(page);
    await onboardGuest(page, "18+");
    await fireTrigger(page, "streak");
    await page.goto("/play/crownfall");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);
    await page.goto("/duel");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(ALERTS)).toHaveCount(0);

    // Allowed for real (Playwright permission): the ask has nothing to ask.
    const real = await context.browser()!.newContext();
    await real.grantPermissions(["notifications"]);
    const p2 = await real.newPage();
    await onboardGuest(p2, "18+");
    await fireTrigger(p2, "friend");
    await p2.goto("/library");
    await p2.waitForTimeout(QUIET_WAIT);
    await expect(p2.locator(ALERTS)).toHaveCount(0);
    await real.close();
  });

  test("Settings > Alerts stays a manual switch", async ({ page }) => {
    await notificationsDefault(page);
    await onboardGuest(page, "18+");
    await page.goto("/settings");
    await expect(page.getByText("Turn and invite alerts").first()).toBeVisible();
  });
});

test.describe("low-data suggestion (R2-04)", () => {
  // Pages served by the service worker don't count as measured loads; keep every load on the network.
  test.use({ serviceWorkers: "block" });

  test("never shows on an unthrottled run", async ({ page }) => {
    await onboardGuest(page, "18+");
    // Warm the routes first, so a dev server's first compile isn't read as a slow connection.
    for (const p of ["/leagues", "/me", "/friends", "/shop"]) await page.request.get(p);
    for (const p of ["/leagues", "/me"]) {
      await page.goto(p);
      await page.waitForTimeout(QUIET_WAIT);
      await expect(page.locator(LOW_DATA)).toHaveCount(0);
    }
    await clickTo(page, "/friends");
    await clickTo(page, "/shop");
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(LOW_DATA)).toHaveCount(0);
  });

  test("shows once on slow 3G after slow loads, then not again this session", async ({ browser }) => {
    test.setTimeout(240_000);
    // No service worker: page loads it answers are not counted (R2-04), and a deployed site has one.
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await onboardGuest(page, "18+");
    await throttle(page, "slow3g");
    let seen = false;
    for (const p of ["/leagues", "/me"]) {
      await page.goto(p, { waitUntil: "load", timeout: 90_000 });
      if (
        await page
          .locator(LOW_DATA)
          .isVisible({ timeout: 5_000 })
          .catch(() => false)
      ) {
        seen = true;
        break;
      }
    }
    if (!seen) await expect(page.locator(LOW_DATA)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("status", { name: "Low-data suggestion" }).getByRole("button", { name: "Not now" }).click();
    await expect(page.locator(LOW_DATA)).toHaveCount(0);
    await page.goto("/shop", { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(LOW_DATA)).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("one prompt queue (R2-04)", () => {
  test("never two prompts on one screen: the higher priority wins, the other waits for the next screen", async ({ page }) => {
    await countPrompts(page);
    await notificationsDefault(page);
    await onboardGuest(page, "18+");
    await fireTrigger(page, "friend");
    await page.goto("/friends");
    await expect(page.locator(ALERTS)).toBeVisible();
    // Low data becomes due on the same screen: it must wait.
    await slowLoads(page);
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(LOW_DATA)).toHaveCount(0);
    await page.getByRole("button", { name: "Not now" }).click();
    await page.waitForTimeout(QUIET_WAIT);
    await expect(page.locator(LOW_DATA)).toHaveCount(0); // this screen's slot is spent
    // Next screen (a client-side navigation, then the slow run is measured again): low data gets its turn.
    // Next screen: low data gets its turn. Clear the synthetic run first: the client-side navigation itself is
    // measured (a fast load ends a slow run, and the network has recovered), so mark the slow loads once the new
    // screen has settled, as a slow connection would.
    await slowLoads(page, 0);
    await clickTo(page, "/me");
    await page.waitForTimeout(1500);
    await slowLoads(page);
    await expect(page.locator(LOW_DATA)).toBeVisible();
    expect(await maxPrompts(page)).toBe(1);
  });
});
