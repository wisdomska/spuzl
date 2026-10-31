import { timingSafeEqual } from "node:crypto";
import { handle, ok, ApiError } from "@/lib/api/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { provisionAdmin, resetRedirect } from "@/lib/admin/provision";

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * POST /api/admin/bootstrap: idempotent owner bootstrap (see docs/OPERATIONS.md, "Admin bootstrap").
 * Creates the auth user for INITIAL_OWNER_EMAIL, makes it an owner and emails a password-reset link.
 * Needs `Authorization: Bearer <CRON_SECRET>`; there is no request body, so no other email can be targeted.
 */
export const POST = handle(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) throw new ApiError(401, "unauthenticated");
  const email = process.env.INITIAL_OWNER_EMAIL;
  if (!email) throw new ApiError(503, "no_owner_email", "Set INITIAL_OWNER_EMAIL first.");
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const r = await provisionAdmin(supabaseAdmin(), {
    email,
    role: "owner",
    redirectTo: resetRedirect(site),
    resend: new URL(req.url).searchParams.has("resend"),
  });
  return ok({ ...r, email: r.email.replace(/^(.).*(@.*)$/, "$1***$2") });
});
