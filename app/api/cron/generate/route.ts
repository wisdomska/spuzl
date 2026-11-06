import { NextResponse } from "next/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fillSchedule } from "@/lib/game/schedule";
import { fillFive } from "@/lib/daily-five/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily Vercel cron (vercel.json): keeps the Daily Five scheduled ahead, then tops the Daily buffer up to 60 days
 * ahead for every game (while Dailies are on).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getGameSettings();
  const db = supabaseAdmin();
  // Daily Five (R2-05, its own switch): keeps "dailyFive.daysAhead" days picked and their puzzles made. First, as it
  // is small and players see it every day.
  let five: Awaited<ReturnType<typeof fillFive>> | { skipped: string };
  try {
    five = settings["dailyFive.enabled"] ? await fillFive(db, settings) : { skipped: "daily_five_off" };
  } catch (e) {
    five = { skipped: e instanceof Error ? e.message.slice(0, 120) : "error" };
  }
  if (!("skipped" in five)) await db.from("audit_log").insert({ action: "cron.daily_five", detail: five });
  // Dailies off (admin "features.dailies"): no new Daily puzzles are generated.
  if (!settings["features.dailies"]) return NextResponse.json({ skipped: "dailies_off", five });
  const result = await fillSchedule(db, { days: 60, budgetMs: 45_000 });
  await db.from("audit_log").insert({ action: "cron.generate_puzzles", detail: result });
  return NextResponse.json({ ...result, five });
}
