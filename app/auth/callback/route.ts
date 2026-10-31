import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      await supabaseAdmin().from("players").update({ is_guest: !!data.user.is_anonymous }).eq("id", data.user.id);
      dest.searchParams.set("auth", "linked");
    }
  } else if (url.searchParams.get("error")) {
    dest.searchParams.set("auth", "failed");
  }
  return NextResponse.redirect(dest);
}
