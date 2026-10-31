/**
 * Owner bootstrap: creates the auth user for INITIAL_OWNER_EMAIL, makes it an owner in `admins`, and emails a
 * password-reset link so the owner sets their own password (then enrols TOTP on first sign-in at /admin).
 * Idempotent: safe to re-run. Pass --resend to send the reset email again if the owner has never signed in.
 *
 *   pnpm tsx --env-file=.env.local scripts/bootstrap-owner.mts [--resend]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INITIAL_OWNER_EMAIL and NEXT_PUBLIC_SITE_URL.
 */
import { createClient } from "@supabase/supabase-js";
import { provisionAdmin, resetRedirect } from "../lib/admin/provision";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.INITIAL_OWNER_EMAIL;
const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}
if (!email) {
  console.error("INITIAL_OWNER_EMAIL is required");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const r = await provisionAdmin(db, { email, role: "owner", redirectTo: resetRedirect(site), resend: process.argv.includes("--resend") });
const masked = r.email.replace(/^(.).*(@.*)$/, "$1***$2");
console.log(
  [
    `owner ${masked}`,
    r.createdUser ? "auth user created" : "auth user exists",
    r.createdAdmin ? "added to admins as owner" : r.roleChanged ? "role set to owner" : "already owner",
    r.resetSent ? "password-reset email sent" : r.resetError ? `reset email not sent: ${r.resetError}` : "no email sent",
  ].join(", "),
);
