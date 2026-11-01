import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { GAME_BY_ID } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/** One game, or a device's whole list when it first syncs to the account. */
const Learned = z.object({ games: z.array(z.string().min(2).max(24)).min(1).max(100) });

/**
 * POST /api/v1/me/learned: the player learned (finished or skipped the guided first play of) these games. Kept
 * on the account so another device skips the practice round too. Unknown games are skipped; repeats are no-ops.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `learned:${player.id}`, 30, 60);
  const { games } = await body(req, Learned);
  // A device list can hold a game id the catalog no longer has: skip those, keep the rest.
  const ids = [...new Set(games)].filter((id) => GAME_BY_ID[id]);
  if (!ids.length) throw new ApiError(400, "unknown_game");
  const { error } = await admin.from("learned_games").upsert(
    ids.map((game_id) => ({ player_id: player.id, game_id })),
    { onConflict: "player_id,game_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  return ok({ learned: ids });
});
