import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes a player's account for good: the one path both the player's own "Delete account" and the admin console
 * use, so the same data rules apply. Crews they captain pass to the longest-standing member instead of vanishing
 * with everyone in them; then the auth user is deleted and everything about the player cascades from `players`
 * (attempts, results, ledgers, friends, feed, inventory, crews nobody else is in, reports they filed).
 * Audit rows that name the player stay (the audit log is append-only and keyed by text).
 */
export async function deleteAccount(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: owned, error: e1 } = await admin.from("crews").select("id").eq("owner_id", userId);
  if (e1) throw e1;
  for (const c of owned ?? []) {
    const { data: next } = await admin
      .from("crew_members")
      .select("player_id")
      .eq("crew_id", c.id)
      .neq("player_id", userId)
      .order("joined_at")
      .limit(1);
    if (next?.length) {
      await admin.from("crews").update({ owner_id: next[0].player_id }).eq("id", c.id);
      await admin.from("crew_members").update({ role: "captain" }).eq("crew_id", c.id).eq("player_id", next[0].player_id);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
