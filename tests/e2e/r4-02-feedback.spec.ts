import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, runAxe, VIEWPORTS } from "./harness";

/**
 * R4-02: feedback the way SPIL does it. A signed-out visitor sends a message from /contact; a signed-in guest opens
 * "Send feedback" in Settings, which carries ?from=/settings to the form, and sends one with a kind. Screenshots at
 * 375 and 1280 go to docs/qa/screens/r4/. Guests are created with onboardGuest, which logs them for clean-up.
 */

const SHOTS = "docs/qa/screens/r4";
const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);

const form = (page: Page) => page.getByRole("form", { name: "Send us feedback" });

async function send(page: Page) {
  const res = page.waitForResponse((r) => r.url().endsWith("/api/v1/feedback") && r.request().method() === "POST");
  await form(page).getByRole("button", { name: "Send message" }).click();
  return (await res).status();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const w = viewport.width;

  test(`signed out: send feedback from /contact (${name})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
    await expect(form(page).getByLabel("Email, if you want a reply")).toHaveAttribute("type", "email");
    // The fallback inbox, as a mailto link under the form
    await expect(page.getByRole("link", { name: /@/ }).first()).toHaveAttribute("href", /^mailto:/);
    await expect(page.getByText("Our support inbox opens at launch")).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({ path: `${SHOTS}/r4-02-contact-form-${w}.png`, fullPage: true });

    // Too short: the form says so and nothing is sent.
    await form(page).getByLabel("Message").fill("Hi");
    await form(page).getByRole("button", { name: "Send message" }).click();
    await expect(form(page).getByText(/at least 10 characters/)).toBeVisible();

    // A bad email is caught before sending, too.
    await form(page).getByLabel("Email, if you want a reply").fill("not-an-email");
    await form(page).getByLabel("Message").fill(`The Crownfall timer froze on level 3 (qa ${Date.now()}).`);
    await form(page).getByRole("button", { name: "Send message" }).click();
    await expect(form(page).getByText(/doesn't look right/)).toBeVisible();

    await form(page).getByLabel("Email, if you want a reply").fill("");
    expect(await send(page)).toBe(201);
    await expect(page.getByRole("heading", { name: /Message received/ })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/r4-02-contact-sent-${w}.png`, fullPage: true });
    await ctx.close();
  });

  test(`signed in: Settings → Send feedback carries ?from=/settings (${name})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await onboardGuest(page, "16-17");
    await page.goto("/settings");
    const link = page.getByRole("link", { name: "Send feedback" });
    await expect(link).toHaveAttribute("href", "/contact?from=/settings");
    await link.click();
    await page.waitForURL((u) => u.pathname === "/contact" && u.searchParams.get("from") === "/settings");
    await expect(form(page).getByText("We'll add the page you came from: /settings")).toBeVisible();
    await form(page)
      .getByLabel(/What is it about\?/)
      .selectOption({ label: "Idea" });
    await form(page).getByLabel("Email, if you want a reply").fill("qa-feedback@example.com");
    await form(page).getByLabel("Message").fill(`Please add a dark theme timer option (qa ${Date.now()}).`);
    await page.screenshot({ path: `${SHOTS}/r4-02-settings-from-${w}.png`, fullPage: true });
    expect(await send(page)).toBe(201);
    await expect(page.getByText(/reply to the email you left/)).toBeVisible();
    expect(await runAxe(page, { include: "main" })).toEqual([]);
    await ctx.close();
  });
}

test("a crafted from never shows on the form", async ({ page }) => {
  await page.goto("/contact?from=https://evil.example/x");
  await expect(form(page)).toBeVisible();
  await expect(page.getByText(/page you came from/)).toHaveCount(0);
});

test("the Me page and the landing footer link to feedback", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone });
  const page = await ctx.newPage();
  await page.goto("/about");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Feedback" })).toHaveAttribute("href", "/contact?from=/");
  await onboardGuest(page);
  await page.goto("/me");
  await expect(page.getByRole("link", { name: /Send feedback/ })).toHaveAttribute("href", "/contact?from=/me");
  await ctx.close();
});
