import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import type { PlayerRow } from "@/lib/server/player-data";

/**
 * Server-side first-run gate for pages that need a player: no session goes to the logo intro, a session
 * without a profile goes to onboarding. Redirecting on the server means first-time visitors never
 * download and boot the Home or Play screen just to be bounced. Returns the player for pages that
 * prefetch their data; null when the backend is not configured (local demo mode).
 */
export async function requirePlayerPage(): Promise<{ user: User; player: PlayerRow } | null> {
  if (!hasSupabase()) return null;
  const user = await currentUser();
  if (!user) redirect("/intro");
  const { data } = await supabaseAdmin().from("players").select("id, xp, sparks, is_guest").eq("id", user.id).maybeSingle();
  if (!data) redirect("/welcome");
  return { user, player: data as PlayerRow };
}
