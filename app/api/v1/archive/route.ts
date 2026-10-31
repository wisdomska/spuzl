import { z } from "zod";
import { ApiError, handle, ok, requirePlayer, todayGmt } from "@/lib/api/server";
import { GAME_BY_ID } from "@/lib/catalog";
import { LAUNCH_DATE } from "@/lib/format";
import { archiveAccess } from "@/lib/meta";

export const dynamic = "force-dynamic";

const Query = z.object({ game: z.string().min(1).max(32), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/**
 * GET /api/v1/archive?game=&month=YYYY-MM: past Dailies for one game with your status per day.
 * The last 7 days are free; older dates are locked (SPUZL+).
 */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const q = Query.parse({ game: sp.get("game") ?? "", month: sp.get("month") ?? todayGmt().slice(0, 7) });
  if (!GAME_BY_ID[q.game]) throw new ApiError(404, "unknown_game");
  const { admin, player } = await requirePlayer();
  const [y, m] = q.month.split("-").map(Number);
  const first = `${q.month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = todayGmt();
  const [{ data: attempts, error }, { data: dailies }, { data: results }] = await Promise.all([
    admin
      .from("attempts")
      .select("daily_date, status, mode, time_ms")
      .eq("player_id", player.id)
      .eq("game_id", q.game)
      .in("mode", ["daily", "archive"])
      .gte("daily_date", first)
      .lte("daily_date", last),
    admin.from("dailies").select("date").eq("game_id", q.game).gte("date", first).lte("date", last),
    admin
      .from("daily_results")
      .select("date, time_ms")
      .eq("player_id", player.id)
      .eq("game_id", q.game)
      .gte("date", first)
      .lte("date", last),
  ]);
  const ranked = new Map((results ?? []).map((r) => [r.date as string, r.time_ms as number]));
  if (error) throw error;
  const scheduled = new Set((dailies ?? []).map((d) => d.date as string));
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => {
    const date = `${q.month}-${String(i + 1).padStart(2, "0")}`;
    const mine = (attempts ?? []).filter((a) => a.daily_date === date);
    const cleared = mine.find((a) => a.status === "cleared");
    const state = cleared || ranked.has(date) ? "cleared" : mine.length ? "started" : "missed";
    return {
      date,
      access: archiveAccess(date, today, LAUNCH_DATE),
      state: date > today ? "future" : state,
      timeMs: ranked.get(date) ?? cleared?.time_ms ?? null,
      late: cleared?.mode === "archive",
      available: scheduled.has(date) || date <= today,
    };
  });
  return ok({ game: q.game, month: q.month, today, days });
});
