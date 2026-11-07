import { ApiError, handle, ok } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { GAME_BY_ID } from "@/lib/catalog";
import { guidedSeed, loadFree } from "@/lib/game/service";
import { hasLogic } from "@/games/logic-registry";
import { getGameSettings } from "@/lib/game-settings/server";

/**
 * GET /api/admin/games/practice?game=<id>: the game's practice board (R2-07) for the admin Library page's read-only
 * preview: the fixed seed `tutorial:<game>` on easy (or the game's own practice board), with its solution, and
 * whether its practice round is turned off in Settings ("practice.disabled"). Nothing is changed, so nothing is
 * audited; the board itself is edited in code, and the per-game off switch lives on the Settings page.
 */
export const GET = handle(async (req: Request) => {
  await requireAdmin("content.read");
  const game = new URL(req.url).searchParams.get("game") ?? "";
  const meta = GAME_BY_ID[game];
  if (!meta) throw new ApiError(404, "unknown_game");
  if (!hasLogic(meta.id)) throw new ApiError(404, "no_practice_board");
  const [g, settings] = await Promise.all([loadFree(meta.id, guidedSeed(meta.id), "easy"), getGameSettings()]);
  return ok({
    game: meta.id,
    seed: guidedSeed(meta.id),
    puzzle: g.puzzle,
    solution: g.solution,
    off: settings["practice.disabled"].includes(meta.id),
  });
});
