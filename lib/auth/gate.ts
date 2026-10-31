import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Server-side first-run gate for player screens: no session goes to the logo intro, a session without a
 * profile goes to onboarding. Redirecting on the server (instead of after the client boots) is what keeps
 * the first paint fast on a cold phone.
 */
export async function requirePlayerPage(): Promise<void> {
  if (!hasSupabase()) return;
  const user = await currentUser();
  if (!user) redirect("/intro");
  const { data } = await supabaseAdmin().from("players").select("id").eq("id", user.id).maybeSingle();
  if (!data) redirect("/welcome");
}
