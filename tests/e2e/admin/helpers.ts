import { expect, type Page } from "@playwright/test";
import { adminSession, totp, type AdminSession, type Role } from "../../api/admin-helpers";

export { adminSession, totp };

/** Signs in through the real /admin/login: email and password, then the TOTP code. */
export async function login(page: Page, acct: AdminSession, theme: "dark" | "light" = "dark") {
  await page.addInitScript((t) => localStorage.setItem("spuzl.settings", JSON.stringify({ theme: t })), theme);
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(acct.email);
  await page.getByLabel("Password").fill(acct.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Code").fill(totp(acct.secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 20_000 });
}

export async function signedIn(page: Page, role: Role, theme: "dark" | "light" = "dark") {
  const acct = await adminSession(role);
  await login(page, acct, theme);
  return acct;
}
