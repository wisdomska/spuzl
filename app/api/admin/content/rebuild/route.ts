import { z } from "zod";
import { ApiError, body, handle, ok } from "@/lib/api/server";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { isContentGame } from "@/lib/admin/content-schemas";
import { assertSchedulable } from "@/lib/admin/dailies";
import { rebuildUpcoming } from "@/lib/admin/rebuild";
import { hasLogic } from "@/games/logic-registry";

export const maxDuration = 60;

const Body = z.object({ game: z.string().min(2).max(24) });

/**
 * POST /api/admin/content/rebuild {game} (calendar.write): R4-14 "Rebuild upcoming days". After retiring content,
 * rebuilds the game's unlocked future Dailies and Daily Five days that were generated from it, so none deals a
 * retired entry. Locked days, custom items, today and Daily Five days already started stay as they are. Audited
 * as content.rebuild_upcoming with every date it changed or skipped.
 */
export const POST = handle(async (req: Request) => {
  const ctx = await requireAdmin("calendar.write");
  const { game } = await body(req, Body);
  if (!isContentGame(game) || !hasLogic(game)) throw new ApiError(404, "unknown_game");
  assertSchedulable(game);
  const r = await rebuildUpcoming(ctx.db, game);
  await audit(ctx, "content.rebuild_upcoming", `game:${game}`, r);
  return ok(r);
});
