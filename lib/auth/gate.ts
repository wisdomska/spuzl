import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";
import type { PlayerRow } from "@/lib/server/player-data";
import { returnPath } from "@/lib/onboarding-return";

/**
 * Server-side first-run gate for pages that need a player: no session, or a session without a profile, goes
 * straight to the age step of onboarding (/welcome/play; R4-04: the logo intro is not replayed). Redirecting on the server means first-time visitors never
 * download and boot the Home or Play screen just to be bounced. Returns the player for pages that
 * prefetch their data; null when the backend is not configured (local demo mode).
 *
 * `back`: a deep link's name (lib/onboarding-return.ts: "daily", or "game:<id>" for a real game, R4-03); first-run
 * visitors come back to it after onboarding instead of landing on Home. Unknown names are dropped.
 */
const backQuery = (back?: string) => (back && returnPath(back) ? `?return=${encodeURIComponent(back)}` : "");

/** The first-run page a gate sends visitors to: the age step (it offers sign-in when a deep link sent them). */
export const FIRST_RUN = "/welcome/play";

/** Session only (no database): signed-out visitors go to the age step. */
export async function requireSessionPage(opts: { back?: string } = {}): Promise<void> {
  if (!hasSupabase()) return;
  if (!(await currentUser())) redirect(`${FIRST_RUN}${backQuery(opts.back)}`);
}

export async function requirePlayerPage(opts: { back?: string } = {}): Promise<{ user: User; player: PlayerRow } | null> {
  if (!hasSupabase()) return null;
  const q = backQuery(opts.back);
  const user = await currentUser();
  if (!user) redirect(`${FIRST_RUN}${q}`);
  const { data } = await supabaseAdmin().from("players").select("id, xp, sparks, is_guest").eq("id", user.id).maybeSingle();
  if (!data) redirect(`${FIRST_RUN}${q}`);
  return { user, player: data as PlayerRow };
}
