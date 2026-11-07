import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameSettings } from "@/lib/game-settings/server";

/** What the sign-in streak shield did: one Freeze granted, Freezes already full, or already given before. */
export type ShieldResult = { status: "granted" | "full" | "already"; freezes?: number };

/**
 * R2-P5 streak shield (admin "features.streakShield"): a guest who just linked an email or Google account gets one
 * Streak Freeze, once per account. Call it after linking and BEFORE is_guest is cleared: svc_signin_shield only
 * grants while the row still says guest, and its ledger ref makes it once only (audited as player.shield).
 * Returns null when nothing was due (setting off, never a guest, no player row, or a database before the migration).
 */
export async function grantSigninShield(admin: SupabaseClient, playerId: string): Promise<ShieldResult | null> {
  if (!(await getGameSettings())["features.streakShield"]) return null;
  const { data, error } = await admin.rpc("svc_signin_shield", { p_player: playerId });
  if (error) {
    // No profile yet (P0002) or the function isn't deployed yet (PGRST202): linking must still go through.
    if (error.code === "P0002" || error.code === "PGRST202") return null;
    throw error;
  }
  const r = data as { status: string; freezes?: number } | null;
  return r && (r.status === "granted" || r.status === "full" || r.status === "already") ? (r as ShieldResult) : null;
}
