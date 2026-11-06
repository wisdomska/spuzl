import { expect, test, type Browser } from "@playwright/test";
import { ageOf, keepFocus, onboardGuest, runAxe, VIEWPORTS } from "./harness";

/**
 * R2-09 birth step: month select + 4-digit numeric year field (numeric keypad, `bday-year` autofill), a Continue
 * button whose accessible name says what it does, the softer "set once" note, validation, the keypad's Done key,
 * and axe. Month + year only, never a day. Needs the app with a database for the onboardGuest case.
 * Screenshots: docs/qa/screens/r2/r2-09-<name>-<375|1280>.png.
 */
const SIZES = [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const;
const shot = (name: string, w: string) => `docs/qa/screens/r2/r2-09-${name}-${w}.png`;
const y = new Date().getUTCFullYear();

async function birthStep(browser: Browser, viewport: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await keepFocus(page);
  await page.goto("/welcome/play");
  await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
  return { ctx, page };
}

for (const [w, viewport] of SIZES) {
  test.describe(`R2-09 at ${w}`, () => {
    test("numeric year field, named Continue, soft note, no axe violations", async ({ browser }) => {
      const { ctx, page } = await birthStep(browser, viewport);
      const year = page.getByLabel("Year", { exact: true });
      await expect(year).toHaveAttribute("inputmode", "numeric");
      await expect(year).toHaveAttribute("autocomplete", "bday-year");
      await expect(year).toHaveAttribute("maxlength", "4");
      await expect(page.getByLabel("Day")).toHaveCount(0);
      for (const name of ["Month", "Year"]) {
        const box = await page.getByLabel(name, { exact: true }).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByText(/It's set once, so go with your real month and year/)).toBeVisible();
      await expect(page.getByText(/can't change this later/)).toHaveCount(0);

      const go = page.getByRole("button", { name: "Continue with this birth month and year" });
      await expect(go).toBeVisible();
      await expect(go).toBeDisabled();
      await page.screenshot({ path: shot("birth-empty", w) });
      expect(await runAxe(page)).toEqual([]);

      // Digits only, four at most; Continue waits for all four.
      await page.getByLabel("Month", { exact: true }).selectOption("6");
      await year.fill("20");
      await expect(go).toBeDisabled();
      await year.pressSequentially("0a815");
      await expect(year).toHaveValue("2008");
      await expect(go).toBeEnabled();
      await page.screenshot({ path: shot("birth-filled", w) });
      expect(await runAxe(page)).toEqual([]);
      await ctx.close();
    });

    test("validation: a future year and a year too far back say so; the error passes axe", async ({ browser }) => {
      const { ctx, page } = await birthStep(browser, viewport);
      const year = page.getByLabel("Year", { exact: true });
      const go = page.getByRole("button", { name: /^Continue\b/ });
      await page.getByLabel("Month", { exact: true }).selectOption("1");
      await year.fill(String(y + 1));
      await go.click();
      await expect(page.getByRole("alert")).toHaveText("That's in the future. Check the month and year.");
      await expect(year).toHaveAttribute("aria-invalid", "true");
      await page.screenshot({ path: shot("birth-error", w) });
      expect(await runAxe(page)).toEqual([]);
      await year.fill("1900");
      await go.click();
      await expect(page.getByRole("alert")).toHaveText("Pick a real month and year.");
      await ctx.close();
    });

    test("the keypad's Done key continues; under 13 is typed honestly and turned away", async ({ browser }) => {
      const { ctx, page } = await birthStep(browser, viewport);
      await page.getByLabel("Month", { exact: true }).selectOption("1");
      await page.getByLabel("Year", { exact: true }).fill(String(y - 10));
      await page.getByLabel("Year", { exact: true }).press("Enter");
      await expect(page.getByRole("heading", { name: "SPUZL is for 13 and up" })).toBeVisible();
      expect(await page.evaluate(() => fetch("/api/v1/me?optional=1").then((r) => r.json()))).toBeNull();
      await ctx.close();
    });
  });
}

test("onboardGuest({ birthYear, birthMonth }) still works and stores only the band", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.phone });
  const page = await ctx.newPage();
  await keepFocus(page);
  const birthYear = y - 15;
  const birthMonth = 12;
  await onboardGuest(page, { birthYear, birthMonth });
  const me = await page.evaluate(() => fetch("/api/v1/me").then((r) => r.json()));
  expect(me.age_band).toBe(ageOf(birthYear, birthMonth) < 16 ? "13-15" : "16-17");
  // The birth month and year never reach the client.
  expect(JSON.stringify(me)).not.toMatch(/birth_?year|birth_?month/i);
  await ctx.close();
});
