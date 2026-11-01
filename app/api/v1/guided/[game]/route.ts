import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { gameOr404, loadFree } from "@/lib/game/service";
import { hasLogic, loadLogic } from "@/games/logic-registry";
import { guidedCopy } from "@/lib/copy/guided";

/**
 * Guided first play (task: first try of each game is a short hinted round). The practice board comes from the
 * fixed seed `tutorial:<game>` on easy; the solution stays here. Nothing is recorded: no attempt, no XP, no rank.
 */
const SEED = (id: string) => `tutorial:${id}`;

/** GET /api/v1/guided/:game: the practice puzzle (no solution). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/guided/[game]">) => {
  const { game } = await ctx.params;
  const meta = gameOr404(game);
  if (!hasLogic(meta.id)) throw new ApiError(404, "no_guided_round");
  await requirePlayer();
  const g = await loadFree(meta.id, SEED(meta.id), "easy");
  return ok({ puzzle: g.puzzle }, { headers: { "cache-control": "private, max-age=3600" } });
});

const HintReq = z.object({ state: z.unknown().default(null) });

/** POST /api/v1/guided/:game: a hint for the practice board (free and unlimited, rate-limited). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/guided/[game]">) => {
  const { game } = await ctx.params;
  const meta = gameOr404(game);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `guided-hint:${player.id}`, 120, 3600);
  const { state } = await body(req, HintReq);
  const logic = await loadLogic(meta.id);
  // No deduction yet (some games need a first move): coach with the rule so a hint always shows.
  const coach = { target: null, text: `${guidedCopy.ruleHint} ${meta.rule}` };
  if (!logic.hint) return ok({ hint: coach });
  const g = await loadFree(meta.id, SEED(meta.id), "easy");
  let hint = null;
  try {
    hint = logic.hint(g.puzzle, g.solution, state ?? undefined);
  } catch {
    hint = null;
  }
  return ok({ hint: hint ?? coach });
});
