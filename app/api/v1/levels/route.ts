import { ApiError, handle, ok, requirePlayer } from "@/lib/api/server";
import { isLadderGame, levelCount, nextLevel, POOL_LADDERS, SEEDED_LADDERS } from "@/lib/game/levels";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/levels: the player's level ladder progress.
 * - no query: `{ games: { [game]: { top, next, levels } } }` for every ladder game (game cards).
 * - `?game=<id>`: `{ game, top, next, levels, cleared: [{ level, bestMs }] }` (the level list sheet).
 * `top` is the highest verified clear (0 when none), `next` the level to play, `levels` the ladder size (null:
 * endless). Only clears the server verified are here; no seeds or solutions.
 */
export const GET = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  const game = new URL(req.url).searchParams.get("game");
  if (game !== null) {
    if (!isLadderGame(game)) throw new ApiError(404, "no_levels");
    const { data, error } = await admin
      .from("player_levels")
      .select("level, best_ms")
      .eq("player_id", player.id)
      .eq("game_id", game)
      .order("level", { ascending: true })
      .limit(10_000);
    if (error) throw error;
    const cleared = (data ?? []).map((r) => ({ level: r.level as number, bestMs: r.best_ms as number }));
    const top = cleared.length ? cleared[cleared.length - 1].level : 0;
    return ok({ game, top, next: nextLevel(game, top), levels: levelCount(game), cleared });
  }
  const ids = [...Object.keys(POOL_LADDERS), ...SEEDED_LADDERS];
  const { data, error } = await admin.rpc("svc_level_tops", { p_player: player.id });
  if (error) throw error;
  const tops = new Map<string, number>(((data ?? []) as { game_id: string; top: number }[]).map((r) => [r.game_id, r.top]));
  const games: Record<string, { top: number; next: number; levels: number | null }> = {};
  for (const id of ids) {
    const top = tops.get(id) ?? 0;
    games[id] = { top, next: nextLevel(id, top), levels: levelCount(id) };
  }
  return ok({ games });
});
