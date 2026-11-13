import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { afterSignIn } from "@/lib/server/after-sign-in";

/** Google's own button signs in on the page (no redirect); this finishes the same way /auth/callback does. */
export async function POST() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  return NextResponse.json(await afterSignIn(data.user));
}
