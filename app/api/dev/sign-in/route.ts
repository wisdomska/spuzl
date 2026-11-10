import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { TEST_EMAIL, testSignInAllowed } from "@/lib/dev/guard";

const Body = z.object({
  email: z.string().max(200).regex(TEST_EMAIL),
  /** make the account first when it doesn't exist (confirmed, no password) */
  create: z.boolean().default(true),
});

/**
 * POST /api/dev/sign-in {email, create?}: TEST ONLY (R4-27). Signs this browser in as a `.test` email account
 * without sending any email, for E2E specs on hosted projects whose email codes are rate limited (Family Draw).
 * It makes the account if asked, asks the admin API for a one-time code (generateLink, which sends nothing) and
 * verifies it on the server, so the auth cookies land on this response exactly as a typed code would set them.
 * The account then onboards like any new player.
 *
 * Answers 404 unless test sign-in is allowed (lib/dev/guard.ts testSignInAllowed: ENABLE_DEV_ROUTES=1, never on a
 * Vercel production deployment, never in a bare production build without ALLOW_TEST_SIGN_IN=1). Real addresses are
 * refused: only the reserved `.test` domain, which never receives mail, so no player's account can be reached.
 */
export const POST = handle(async (req: Request) => {
  if (!testSignInAllowed()) throw new ApiError(404, "not_found");
  const { email, create } = await body(req, Body);
  const admin = supabaseAdmin();
  if (create) {
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    // Already there: sign in to it.
    if (error && !/already|exists|registered/i.test(error.message)) throw error;
  }
  const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (e1 || !link?.properties?.email_otp) throw new ApiError(404, "no_test_account");
  const sb = await supabaseServer();
  const { data, error: e2 } = await sb.auth.verifyOtp({ email, token: link.properties.email_otp, type: "email" });
  if (e2 || !data.user) throw new ApiError(400, "sign_in_failed", e2?.message);
  return ok({ userId: data.user.id });
});
