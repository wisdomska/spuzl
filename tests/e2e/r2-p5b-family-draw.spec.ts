import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin } from "../api/helpers";
import { birthFor, keepFocus, logGuest, onboardGuest, VIEWPORTS, type Age } from "./harness";

/**
 * R2-P5 part B: Family Draw, Draw It for signed-in players aged 16 and over (party mode "drawfam", setting
 * "party.familyDraw"). Preset words, guessers pick the word from four (no typing), drawings keep their Report
 * button. Under-16s and guests never see the mode.
 *
 * Signs in real email accounts: the account is made with the admin API, the app sends its sign-in code, and the
 * spec reads a fresh code from the admin API (`generateLink`, local Supabase) and types it. Flips
 * "party.familyDraw" in game_settings and puts it back; run with --workers=1 against a server with a database that
 * reads settings without a cache. Screenshots: docs/qa/screens/r2/r2-p5b-family-draw-<name>-<375|1280>.png.
 */
const KEY = "party.familyDraw";
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-p5b-family-draw-${name}-${w}.png` });

async function setFamily(on: boolean) {
  const { error } = await admin().from("game_settings").upsert({ key: KEY, value: on }, { onConflict: "key" });
  if (error) throw error;
}

/** A signed-in email account in an age band, onboarded through the app (birth month and year, nickname). */
async function member(browser: Browser, age: Age, viewport: { width: number; height: number } = VIEWPORTS.phone) {
  const email = `fam${Date.now()}${Math.floor(Math.random() * 1e4)}@family.test`;
  const { error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await keepFocus(page);
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();
  const { data, error: e2 } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (e2) throw e2;
  await page.getByLabel("6-digit code").fill(data.properties.email_otp);
  // A new account sets up like a new player: birth month and year, then a nickname.
  await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible({ timeout: 30_000 });
  const b = birthFor(age);
  await page.getByLabel("Month", { exact: true }).selectOption(String(b.month));
  await page.getByLabel("Year", { exact: true }).fill(String(b.year));
  await page.getByRole("button", { name: /^Continue\b/ }).click();
  await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
  await page.locator("#nick").fill(`Fam${Date.now() % 1e6}`);
  await page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await logGuest(page);
  return { context, page };
}

let before: unknown = undefined;
test.beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
  before = data?.value;
  await setFamily(true);
});
test.afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await setFamily(before as boolean);
});

test.describe.configure({ mode: "serial" });

const familyRadio = (page: Page) => page.getByRole("radio", { name: /^Family Draw, 16\+/ });

test("under-16s and guests never see Family Draw; a signed-in 16-17 player does", async ({ browser, page }) => {
  test.setTimeout(180_000);
  await onboardGuest(page, { age: "13-15" });
  await page.goto("/party");
  await expect(page.getByRole("button", { name: "Open room" })).toBeVisible();
  await expect(familyRadio(page)).toHaveCount(0);

  const teen = await member(browser, "16-17");
  await teen.page.goto("/party");
  await expect(familyRadio(teen.page)).toBeVisible();
  // A 16-17 player gets the race and Family Draw, never the 18+ modes.
  await expect(teen.page.getByRole("radio", { name: /^Two Truths, 18\+/ })).toHaveCount(0);
  await teen.context.close();
});

test("a Family Draw round: preset word, four options to pick from, no typing, a Report button on the drawing", async ({ browser }) => {
  test.setTimeout(240_000);
  const host = await member(browser, "16-17");
  const guesser = await member(browser, "18+");
  await host.page.goto("/party");
  await familyRadio(host.page).click();
  await host.page.getByRole("button", { name: "Open room" }).click();
  await host.page.waitForURL(/\/party\/[A-Z0-9]{4}/, { timeout: 30_000 });
  const code = new URL(host.page.url()).pathname.split("/").pop()!;

  await guesser.page.goto(`/party/${code}`);
  await expect(guesser.page.getByText("Family Draw, 16+.")).toBeVisible();
  await guesser.page.getByRole("button", { name: /^Join$/ }).click();
  await guesser.page.getByRole("button", { name: /^Ready$/ }).click();
  await host.page.getByRole("button", { name: /^Start/ }).click();

  // The host (seat 0) draws first and sees the word.
  const word = (await host.page
    .getByText(/^Draw this/)
    .locator("span")
    .first()
    .textContent({ timeout: 30_000 }))!.trim();
  const canvas = host.page.getByRole("img", { name: /Drawing board\. Draw/ });
  const box = (await canvas.boundingBox())!;
  await host.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await host.page.mouse.down();
  await host.page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
  await host.page.mouse.up();

  // The guesser picks from four words; there is no text box.
  await expect(guesser.page.getByText("Which word is it?")).toBeVisible({ timeout: 30_000 });
  const picks = guesser.page.getByRole("group", { name: "Which word is it?" }).getByRole("button");
  await expect(picks).toHaveCount(4);
  await expect(guesser.page.getByRole("textbox", { name: "Your guess" })).toHaveCount(0);
  await expect(guesser.page.getByRole("button", { name: "Report drawing" })).toBeVisible({ timeout: 15_000 });
  await shot(guesser.page, "pick", VIEWPORTS.phone.width);
  await shot(host.page, "draw", VIEWPORTS.phone.width);

  await guesser.page.getByRole("button", { name: `Pick ${word}` }).click();
  await expect(guesser.page.getByText(`The word was ${word}`)).toBeVisible({ timeout: 30_000 });
  await host.context.close();
  await guesser.context.close();
});

test("screenshots of the Host tab at 375 and 1280", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const vp of Object.values(VIEWPORTS)) {
    const m = await member(browser, "16-17", vp);
    await m.page.goto("/party");
    await familyRadio(m.page).click();
    await expect(m.page.getByText("One draws a preset word, the rest pick it from four").first()).toBeVisible();
    await m.page.screenshot({ path: `docs/qa/screens/r2/r2-p5b-family-draw-host-${vp.width}.png` });
    await m.context.close();
  }
});
