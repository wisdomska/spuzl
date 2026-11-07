import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { grantSigninShield } from "@/lib/server/streak-shield";

/**
 * OAuth and magic-link return: exchanges the code for a session cookie, marks a linked guest as a full
 * account (same user id, so progress stays), then sends the player back to `next` (same-origin paths only).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/settings";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/settings";
  const dest = new URL(next, url.origin);
  if (code) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (error) dest.searchParams.set("auth", "failed");
    else if (data.user) {
      const admin = supabaseAdmin();
      // R2-P5: a guest who just linked Google gets the streak shield (once per account) before is_guest clears.
      const shield = data.user.is_anonymous ? null : await grantSigninShield(admin, data.user.id).catch(() => null);
      await admin.from("players").update({ is_guest: !!data.user.is_anonymous }).eq("id", data.user.id);
      dest.searchParams.set("auth", "linked");
      if (shield?.status === "granted") dest.searchParams.set("shield", "1");
    }
  } else if (url.searchParams.get("error")) {
    dest.searchParams.set("auth", "failed");
  }
  return NextResponse.redirect(dest);
}
