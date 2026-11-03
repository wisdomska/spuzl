import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Two players' record against each other across every finished Duel: wins each way and draws. */
export interface HeadToHead {
  me: number;
  them: number;
  draws: number;
  played: number;
}

/**
 * Head-to-head between `me` and `them` (finished duels, newest 500 of mine). Three small reads; only asked for at
 * a duel's start and end, never on every poll.
 */
export async function headToHead(admin: SupabaseClient, me: string, them: string): Promise<HeadToHead> {
  const empty = { me: 0, them: 0, draws: 0, played: 0 };
  const { data: mine } = await admin
    .from("match_players")
    .select("match_id")
    .eq("player_id", me)
    .order("joined_at", { ascending: false })
    .limit(500);
  const ids = (mine ?? []).map((r) => r.match_id as string);
  if (!ids.length) return empty;
  const { data: shared } = await admin.from("match_players").select("match_id").eq("player_id", them).in("match_id", ids);
  const both = (shared ?? []).map((r) => r.match_id as string);
  if (!both.length) return empty;
  const { data: rows } = await admin.from("matches").select("winner_id").in("id", both).eq("kind", "duel").eq("status", "finished");
  const out = { ...empty };
  for (const r of rows ?? []) {
    out.played++;
    if (r.winner_id === me) out.me++;
    else if (r.winner_id === them) out.them++;
    else out.draws++;
  }
  return out;
}
