import { handle, ok, ApiError } from "@/lib/api/server";
import { requirePasswordAdmin } from "@/lib/admin/auth";
import { codeClient } from "@/lib/admin/email-code";

/**
 * POST /api/admin/login/code: after the password, email this admin a 6-digit code (Supabase's email code, sent
 * through the project's SMTP). Only an active admin signed in with a password can ask, and only for their own email.
 */
export const POST = handle(async () => {
  const { user } = await requirePasswordAdmin();
  const { error } = await codeClient().auth.signInWithOtp({ email: user.email!, options: { shouldCreateUser: false } });
  if (error) {
    if (error.status === 429 || /rate|seconds|many/i.test(error.message))
      throw new ApiError(429, "too_many", "Wait a minute, then ask for a new code.");
    throw new ApiError(502, "code_not_sent", "The code email didn't send. Try again.");
  }
  return ok({ sent: true });
});
