import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";
import { guest, uniq } from "../api/helpers";

/** Settings: a Back button by the title, and the nickname can be changed (rules and "taken" from the server). */
test("settings: back to Me, and change the nickname", async ({ page }, info) => {
  // Someone else already has this name.
  const taken = uniq("Tk");
  await guest(taken);
  await onboardGuest(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "Edit profile and settings" }).click();
  await page.waitForURL(/\/settings/);
  await page.getByRole("button", { name: "Back" }).click();
  await page.waitForURL((u) => u.pathname === "/me");

  // A fresh tab straight onto Settings: Back still lands in the app (Me).
  await page.goto("/settings");
  await page.getByRole("button", { name: "Back" }).click();
  await page.waitForURL((u) => u.pathname === "/me");

  await page.goto("/settings");
  await page.getByRole("button", { name: /Nickname/ }).click();
  const sheet = page.getByRole("dialog", { name: "Change your nickname" });
  const input = sheet.getByLabel("Nickname");
  await input.fill("ab");
  await expect(sheet.getByRole("button", { name: "Save nickname" })).toBeDisabled();
  await input.fill(taken);
  await sheet.getByRole("button", { name: "Save nickname" }).click();
  await expect(sheet.getByText("That name is taken. Try another.")).toBeVisible();
  const fresh = `Nn${Date.now() % 1e7}`;
  await input.fill(fresh);
  await sheet.getByRole("button", { name: "Save nickname" }).click();
  await expect(page.getByText(`You're now ${fresh}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`Nickname.*${fresh}`) })).toBeVisible();
  await page.screenshot({ path: `docs/qa/screens/after/settings-${info.project.name}.png` });
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: fresh })).toBeVisible();
});
