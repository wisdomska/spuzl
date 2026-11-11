import { expect, type Page } from "@playwright/test";
import { adminSession, totp, type AdminSession, type Role } from "../../api/admin-helpers";
import { admin } from "../../api/helpers";

export { adminSession, totp };

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** The newest 6-digit code emailed to `email` after `since` (local Supabase delivers to Mailpit). */
export async function mailCode(email: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`);
    const { messages = [] } = (await r.json()) as { messages?: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => Date.parse(m.Created) >= since - 2000);
    if (fresh) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text?: string; HTML?: string };
      const code = `${m.Text ?? ""} ${m.HTML ?? ""}`.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`no code emailed to ${email}`);
}

/**
 * The sign-in code for a test admin: from Mailpit on a local Supabase; on a hosted project (no Mailpit, and the
 * `@admin.test` address can't receive mail) a fresh one-time code from the admin API (generateLink, sends nothing).
 */
export async function loginCode(email: string, since: number): Promise<string> {
  const local = await fetch(`${MAILPIT}/api/v1/info`).then(
    () => true,
    () => false,
  );
  if (local) return mailCode(email, since);
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return data.properties.email_otp;
}

/** Signs in through the real /admin/login: email and password, then the code emailed to the admin. */
export async function login(page: Page, acct: AdminSession, theme: "dark" | "light" = "dark") {
  await page.addInitScript((t) => localStorage.setItem("spuzl.settings", JSON.stringify({ theme: t })), theme);
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(acct.email);
  await page.getByLabel("Password").fill(acct.password);
  const since = Date.now();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Code").fill(await loginCode(acct.email, since));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 20_000 });
}

export async function signedIn(page: Page, role: Role, theme: "dark" | "light" = "dark") {
  const acct = await adminSession(role);
  await login(page, acct, theme);
  return acct;
}
