import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nicknameProblem } from "@/lib/validation/nickname";

export const CREW_MAX = 20;

/** Crew names: 3 to 24 letters, digits or spaces, run through the nickname filter in overlapping windows. */
export function crewNameProblem(name: string): string | null {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 3) return "At least 3 characters.";
  if (n.length > 24) return "24 characters max.";
  if (!/^[A-Za-z0-9 ]+$/.test(n)) return "Letters, numbers and spaces only.";
  const flat = n.replace(/ /g, "");
  const windows = flat.length <= 16 ? [flat] : Array.from({ length: Math.ceil((flat.length - 8) / 8) }, (_, i) => flat.slice(i * 8, i * 8 + 16));
  for (const w of windows) if (w.length >= 3 && nicknameProblem(w)) return "Pick another name.";
  return null;
}

/** XP each member earned this week (crew clash and "This week's carry"). */
export async function memberWeekXp(admin: SupabaseClient, ids: string[], weekStart: string): Promise<Map<string, number>> {
  const out = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return out;
  const { data, error } = await admin
    .from("xp_ledger")
    .select("player_id, amount")
    .in("player_id", ids)
    .gte("created_at", `${weekStart}T00:00:00Z`);
  if (error) throw error;
  for (const r of data ?? []) out.set(r.player_id, (out.get(r.player_id) ?? 0) + r.amount);
  return out;
}
