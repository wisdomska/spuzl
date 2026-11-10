import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import type { PlayerRow } from "@/lib/server/player-data";
import { returnPath } from "@/lib/onboarding-return";

/**
 * Server-side first-run gate for pages that need a player: no session goes to the logo intro, a session
 * without a profile goes to onboarding. Redirecting on the server means first-time visitors never
 * download and boot the Home or Play screen just to be bounced. Returns the player for pages that
 * prefetch their data; null when the backend is not configured (local demo mode).
 *
 * `back`: a deep link's name (lib/onboarding-return.ts: "daily", or "game:<id>" for a real game, R4-03); first-run
 * visitors come back to it after onboarding instead of landing on Home. Unknown names are dropped.
 */
const backQuery = (back?: string) => (back && returnPath(back) ? `?return=${encodeURIComponent(back)}` : "");

/** Session only (no database): signed-out visitors go to the intro. */
export async function requireSessionPage(opts: { back?: string } = {}): Promise<void> {
  if (!hasSupabase()) return;
  if (!(await currentUser())) redirect(`/intro${backQuery(opts.back)}`);
}

export async function requirePlayerPage(opts: { back?: string } = {}): Promise<{ user: User; player: PlayerRow } | null> {
  if (!hasSupabase()) return null;
  const q = backQuery(opts.back);
  const user = await currentUser();
  if (!user) redirect(`/intro${q}`);
  const { data } = await supabaseAdmin().from("players").select("id, xp, sparks, is_guest").eq("id", user.id).maybeSingle();
  if (!data) redirect(`/welcome${q}`);
  return { user, player: data as PlayerRow };
}
