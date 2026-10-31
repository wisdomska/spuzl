import { handle, ok } from "@/lib/api/server";
import { currentUser } from "@/lib/supabase/server";
import { loadToday } from "@/lib/server/player-data";

export const dynamic = "force-dynamic";

/** Today's Dailies for every live game, plus this player's status per game. */
export const GET = handle(async () => ok(await loadToday(await currentUser())));
