import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/** Invites open a share sheet with several apps, not only WhatsApp. */
test("friends invite: Share opens a sheet of apps", async ({ page }, info) => {
  await onboardGuest(page);
  await page.goto("/friends");
  await page.getByRole("button", { name: "Share" }).click();
  const sheet = page.getByRole("dialog", { name: "Invite friends" });
  for (const app of ["WhatsApp", "Snapchat", "Instagram", "TikTok", "Telegram", "Messages", "Email"])
    await expect(sheet.getByRole("button", { name: app, exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Copy link/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/qa/screens/after/invite-share-${info.project.name}.png` });
});
