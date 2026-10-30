import { handle, ok, todayGmt } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GAMES } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { dailyNumber, msToReset } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Today's Dailies for every live game, plus this player's status per game. */
export const GET = handle(async () => {
  const date = todayGmt();
  const user = await currentUser();
  const admin = supabaseAdmin();
  const status: Record<string, { state: "new" | "in_progress" | "cleared"; timeMs?: number }> = {};
  if (user) {
    const { data } = await admin
      .from("attempts")
      .select("game_id, status, time_ms")
      .eq("player_id", user.id)
      .eq("daily_date", date)
      .eq("mode", "daily");
    for (const a of data ?? [])
      status[a.game_id] = a.status === "cleared" ? { state: "cleared", timeMs: a.time_ms } : { state: "in_progress" };
  }
  return ok({
    date,
    number: dailyNumber(date),
    resetsInMs: msToReset(),
    games: GAMES.map((g) => ({ id: g.id, world: g.world, ready: hasLogic(g.id), ...(status[g.id] ?? { state: "new" }) })),
  });
});
