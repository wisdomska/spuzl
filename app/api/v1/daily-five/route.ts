import { handle, ok } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadDailyFive } from "@/lib/daily-five/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/daily-five: today's five (the same for everyone), and for a signed-in player their progress per game,
 * how many are played and the combined score, all from the server's records. Signed-out visitors get the five
 * without progress. `enabled: false` while the admin setting "dailyFive.enabled" is off.
 */
export const GET = handle(async () => {
  const user = await currentUser();
  return ok(await loadDailyFive(user?.id ?? null, supabaseAdmin()));
});
