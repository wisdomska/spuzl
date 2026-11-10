import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { assertGameOpen, gameOr404, guidedSeed, loadFree } from "@/lib/game/service";
import { hasLogic } from "@/games/logic-registry";
import { loadServedLogic as loadLogic } from "@/lib/game/served-logic";
import { guidedCopy } from "@/lib/copy/guided";
import { bindPuzzle } from "@/lib/game/guess-token";
import { getGameSettings } from "@/lib/game-settings/server";
import { loadGamesMeta, withCopy } from "@/lib/games-meta/server";

/**
 * Guided first play (task: first try of each game is a short hinted round). The practice board comes from the
 * fixed seed `tutorial:<game>` on easy; the solution stays here. Nothing is recorded: no attempt, no XP, no rank.
 */
const SEED = guidedSeed;

/** GET /api/v1/guided/:game: the practice puzzle (no solution). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/guided/[game]">) => {
  const { game } = await ctx.params;
  const meta = gameOr404(game);
  await assertGameOpen(meta);
  if (!hasLogic(meta.id)) throw new ApiError(404, "no_guided_round");
  // R2-07: the admin can turn a game's practice round off ("practice.disabled"); the client then goes straight in.
  if ((await getGameSettings())["practice.disabled"].includes(meta.id)) throw new ApiError(404, "practice_off");
  const { player } = await requirePlayer();
  const g = await loadFree(meta.id, SEED(meta.id), "easy");
  // A content game's reference goes out as a token good only for this practice board (guess route).
  const puzzle = bindPuzzle(g.puzzle, player.id, { k: "p" });
  return ok({ puzzle }, { headers: { "cache-control": "private, max-age=3600" } });
});

const HintReq = z.object({ state: z.unknown().default(null) });

/** POST /api/v1/guided/:game: a hint for the practice board (free and unlimited, rate-limited). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/guided/[game]">) => {
  const { game } = await ctx.params;
  const meta = gameOr404(game);
  await assertGameOpen(meta);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `guided-hint:${player.id}`, 120, 3600);
  const { state } = await body(req, HintReq);
  const logic = await loadLogic(meta.id);
  // A game with no hint for this state (or none at all) coaches with the rule, so a hint always shows. Dusk, Nine and
  // Merge hint from the dealt board before the first move (R4-28), so their first hint is a real move.
  // R4-10: the rule as the admin wrote it (Library page), else the catalog's.
  const coach = { target: null, text: `${guidedCopy.ruleHint} ${withCopy(meta, await loadGamesMeta()).rule}` };
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
