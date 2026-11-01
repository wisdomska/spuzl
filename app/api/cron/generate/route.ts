import { NextResponse } from "next/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fillSchedule } from "@/lib/game/schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily Vercel cron (vercel.json): tops the Daily buffer up to 60 days ahead for every game.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Dailies off (admin "features.dailies"): no new Daily puzzles are generated.
  if (!(await getGameSettings())["features.dailies"]) return NextResponse.json({ skipped: "dailies_off" });
  const db = supabaseAdmin();
  const result = await fillSchedule(db, { days: 60, budgetMs: 45_000 });
  await db.from("audit_log").insert({ action: "cron.generate_puzzles", detail: result });
  return NextResponse.json(result);
}
