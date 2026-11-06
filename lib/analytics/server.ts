import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGE_BANDS, type AgeBand } from "@/lib/age";

/**
 * First-party metrics the server records itself, because only the server knows the facts (the player's age band,
 * whether a duel was really created). Same anonymous table as the client events (public.client_metrics): a name,
 * a kind and the age band, never a player id. Never throws and never blocks the request it rides on.
 */
export type DuelKind = "friend" | "quick";

/** Pure: the row for one created duel. Exported for tests. */
export function duelCreatedRow(band: string, kind: DuelKind) {
  return { name: "duel_created", kind, band: (AGE_BANDS as readonly string[]).includes(band) ? (band as AgeBand) : null };
}

/** One duel was created: `kind` friend (Challenge a friend) or quick (Quick Match pairing), by the creator's band. */
export async function recordDuelCreated(admin: SupabaseClient, band: string, kind: DuelKind): Promise<void> {
  try {
    const { error } = await admin.from("client_metrics").insert(duelCreatedRow(band, kind));
    if (error) console.warn("[metrics] duel_created not recorded", error.message);
  } catch (e) {
    console.warn("[metrics] duel_created not recorded", e);
  }
}
