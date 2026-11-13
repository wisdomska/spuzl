import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { grantSigninShield } from "@/lib/server/streak-shield";

/**
 * After Google or email sign-in: a guest who just linked an account gets the streak shield (once per account), and
 * is_guest follows the account. Shared by the OAuth return (/auth/callback) and Google's own button (/api/v1/auth/finish).
 */
export async function afterSignIn(user: User): Promise<{ shield: boolean }> {
  const admin = supabaseAdmin();
  const shield = user.is_anonymous ? null : await grantSigninShield(admin, user.id).catch(() => null);
  await admin.from("players").update({ is_guest: !!user.is_anonymous }).eq("id", user.id);
  return { shield: shield?.status === "granted" };
}
