import { NextResponse } from "next/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runStreakNudge } from "@/lib/alerts/streak-nudge.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly streak-at-risk nudge (R3-09). Called every hour by the scheduler (.github/workflows/streak-nudge.yml, or a
 * Vercel cron on a plan that allows hourly ones) with `Authorization: Bearer $CRON_SECRET`; anything else is
 * rejected. Sends the evening push to players whose local hour is the admin's send hour (lib/alerts/streak-nudge.ts),
 * at most once per player per GMT day, and logs each run that had candidates (audit action cron.streak_nudge).
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  try {
    const run = await runStreakNudge(db, await getGameSettings());
    if (run.candidates > 0) await db.from("audit_log").insert({ action: "cron.streak_nudge", detail: run });
    return NextResponse.json(run);
  } catch (e) {
    console.error("[cron streak-nudge]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
