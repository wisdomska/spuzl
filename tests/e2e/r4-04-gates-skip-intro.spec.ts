import { expect, test } from "@playwright/test";
import { logGuest, pickBirth } from "./harness";

/**
 * R4-04: first-run gates (lib/auth/gate.ts), invite links (/i/<code>) and the /daily deep link go straight to the
 * age step (/welcome/play), not the /intro logo animation, and still come back where the visitor was going. A
 * returning player whose session ended gets "Played before? Sign in" there (the "Ready to play?" choice was
 * skipped). Needs the app with a database (the lead runs it).
 */

const born = (page: import("@playwright/test").Page) => page.getByRole("heading", { name: /When were you born\?/ });

test("/daily goes straight to the age step and returns to the Daily Five", async ({ page }) => {
  const seen: string[] = [];
  page.on("framenavigated", (f) => f === page.mainFrame() && seen.push(new URL(f.url()).pathname));
  await page.goto("/daily");
  await page.waitForURL(/\/welcome\/play\?return=daily/);
  await expect(born(page)).toBeVisible();
  expect(seen).not.toContain("/intro");
  await pickBirth(page, "18+");
  await page.getByRole("button", { name: /Jump straight in|Go to the map/ }).click();
  await page.locator("#nick").fill(`Qg${Date.now() % 1e7}`);
  await page.getByRole("button", { name: /Enter The Grid|Create my Spuz|Save my Spuz/ }).click();
  await page.waitForURL((u) => u.pathname === "/daily", { timeout: 30_000 });
  await logGuest(page);
});

test("a game page's gate goes straight to the age step with the game to come back to", async ({ page }) => {
  await page.goto("/play/sixer?mode=free");
  await page.waitForURL((u) => u.pathname === "/welcome/play" && /^game:sixer$/.test(u.searchParams.get("return") ?? ""));
  await expect(born(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Played before? Sign in" })).toBeVisible();
});

test("an invite link's Let's go opens the age step, with a way to sign in", async ({ page }) => {
  await page.goto("/i/ABCDEFGH");
  await page.getByRole("link", { name: "Let's go" }).click();
  await page.waitForURL((u) => u.pathname === "/welcome/play");
  await expect(born(page)).toBeVisible();
  // Signing in instead: back to the guest / Google / email choice.
  await page.getByRole("button", { name: "Played before? Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign in with email" })).toBeVisible();
  await page.screenshot({ path: "docs/qa/screens/r4/r4-04-signin-choice-375.png" });
});

test("the landing's Play now keeps its age step without the sign-in line (R2-08)", async ({ page }) => {
  await page.goto("/welcome/play");
  await expect(born(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Played before? Sign in" })).toHaveCount(0);
});
