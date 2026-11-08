import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveBand } from "@/lib/age";
import { gmtDate } from "@/lib/format";
import { pushTo, type PushMessage } from "@/lib/push/server";
import { nudgeMessage, nudgeVerdict, type NudgeSettings, type NudgeVerdict } from "./streak-nudge";

interface CandidateRow {
  player_id: string;
  country: string | null;
  age_band: string | null;
  birth_year: number | null;
  birth_month: number | null;
  streak: number;
  freezes: number;
}

export interface NudgeRun {
  day: string;
  /** admin "streakNudge.enabled" is off: nothing was read or sent */
  off?: boolean;
  candidates: number;
  sent: number;
  /** claimed but no device took the push (subscriptions gone) */
  undelivered: number;
  /** another run claimed the same player and day first */
  already: number;
  /** left for the next hourly run: this one ran out of time (the catch-up hour still covers them) */
  deferred: number;
  skipped: Partial<Record<Exclude<NudgeVerdict, "send" | "off">, number>>;
}

/**
 * One run of the hourly streak-nudge job (GET /api/cron/streak-nudge). Idempotent per player and GMT day: the
 * send log's primary key is claimed before the push goes out, so overlapping or repeated runs never send twice.
 * `send` is injectable for tests; it defaults to Web Push to every device of the player.
 */
export async function runStreakNudge(
  db: SupabaseClient,
  settings: NudgeSettings,
  now: Date = new Date(),
  send: (db: SupabaseClient, playerId: string, msg: PushMessage) => Promise<number> = pushTo,
  budgetMs = 45_000,
): Promise<NudgeRun> {
  const started = Date.now();
  const day = gmtDate(now);
  const run: NudgeRun = { day, candidates: 0, sent: 0, undelivered: 0, already: 0, deferred: 0, skipped: {} };
  if (!settings["streakNudge.enabled"]) return { ...run, off: true };
  const { data, error } = await db.rpc("svc_streak_nudge_candidates", {
    p_today: day,
    p_min: settings["streakNudge.minStreak"],
    p_limit: 5000,
  });
  if (error) throw error;
  const rows = (data ?? []) as CandidateRow[];
  run.candidates = rows.length;
  for (const [i, r] of rows.entries()) {
    if (Date.now() - started > budgetMs) {
      run.deferred = rows.length - i;
      break;
    }
    const verdict = nudgeVerdict(
      { player_id: r.player_id, country: r.country, band: effectiveBand(r, now), streak: r.streak, freezes: r.freezes },
      settings,
      now,
    );
    if (verdict === "off") continue;
    if (verdict !== "send") {
      run.skipped[verdict] = (run.skipped[verdict] ?? 0) + 1;
      continue;
    }
    const claim = await db.from("streak_nudges").insert({ player_id: r.player_id, day, streak: r.streak, sent_at: now.toISOString() });
    if (claim.error) {
      if (claim.error.code === "23505") {
        run.already++;
        continue;
      }
      throw claim.error;
    }
    const devices = await send(db, r.player_id, nudgeMessage(r.streak, r.freezes));
    if (devices > 0) {
      run.sent++;
      await db
        .from("streak_nudges")
        .update({ devices: Math.min(devices, 32767) })
        .eq("player_id", r.player_id)
        .eq("day", day);
    } else run.undelivered++;
  }
  return run;
}
