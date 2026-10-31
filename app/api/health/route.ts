import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Keep-alive target (GitHub Actions every 3 days): runs `select 1` so Supabase Free never pauses. */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().rpc("health");
    if (error) throw error;
    return NextResponse.json({ ok: data === 1, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
