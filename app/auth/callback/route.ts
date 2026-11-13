import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { afterSignIn } from "@/lib/server/after-sign-in";

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
      // R2-P5: a guest who just linked Google gets the streak shield (once per account) before is_guest clears.
      const { shield } = await afterSignIn(data.user);
      dest.searchParams.set("auth", "linked");
      if (shield) dest.searchParams.set("shield", "1");
    }
  } else if (url.searchParams.get("error")) {
    dest.searchParams.set("auth", "failed");
  }
  return NextResponse.redirect(dest);
}
