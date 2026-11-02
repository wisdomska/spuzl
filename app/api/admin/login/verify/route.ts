import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { requirePasswordAdmin } from "@/lib/admin/auth";
import { codeClient } from "@/lib/admin/email-code";

const Body = z.object({ code: z.string().regex(/^\d{6}$/) });

/**
 * POST /api/admin/login/verify {code}: checks the emailed code for this admin. A correct code marks this sign-in
 * session as verified for 12 hours (the admin gate reads it), removes any old authenticator-app factor (the email
 * code replaces it) and writes the audit log. The check's own short-lived session is revoked at once.
 */
export const POST = handle(async (req: Request) => {
  const { user, sessionId, db, role } = await requirePasswordAdmin();
  const { code } = await body(req, Body);
  const { data, error } = await codeClient().auth.verifyOtp({ email: user.email!, token: code, type: "email" });
  if (error || !data.user || data.user.id !== user.id)
    throw new ApiError(400, "bad_code", "That code didn't work. Check it, or send a new one.");
  if (data.session) await db.auth.admin.signOut(data.session.access_token, "local").catch(() => undefined);

  const { error: e } = await db.from("admin_verified_sessions").upsert({
    session_id: sessionId,
    user_id: user.id,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(),
  });
  if (e) throw e;

  // The email code replaces the authenticator app: drop old factors so they never block a password change.
  const { data: factors } = await db.auth.admin.mfa.listFactors({ userId: user.id });
  for (const f of factors?.factors ?? []) await db.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });

  await db
    .from("admins")
    .update({ totp_enrolled: true, email: user.email ?? null })
    .eq("user_id", user.id);
  await db
    .from("audit_log")
    .insert({ actor_id: user.id, action: "admin.email_code_verified", target: `admin:${user.id}`, detail: { role } });
  return ok({ verified: true });
});
