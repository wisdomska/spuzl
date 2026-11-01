import { z } from "zod";
import { body, handle, ok, ApiError } from "@/lib/api/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getPuzzle, logicFor } from "@/lib/admin/puzzles";
import { decodeSolution } from "@/lib/game/solution-codec";
import { PRACTICE, type GuessLogic } from "@/games/_shared/guess";

const Body = z.object({ guess: z.unknown().default(null) });

/**
 * POST /api/admin/puzzles/:id/guess: the guess transport for the admin preview (Show solution, Play test) of
 * content games. Checks against the stored puzzle and solution, so human-written items answer correctly, and
 * as practice: the admin may see answers (Five's word, Emoji Hits' titles, Penalty King's dives). Nothing is
 * recorded.
 */
export const POST = handle(async (req: Request, rc: RouteContext<"/api/admin/puzzles/[id]/guess">) => {
  const ctx = await requireAdmin("calendar.read");
  const id = z
    .string()
    .uuid()
    .parse((await rc.params).id);
  const { guess } = await body(req, Body);
  const p = await getPuzzle(ctx.db, id);
  const logic = (await logicFor(p.game_id)) as Partial<GuessLogic>;
  if (typeof logic.checkGuess !== "function") throw new ApiError(400, "no_guess_check");
  return ok(logic.checkGuess(p.data, decodeSolution(p.solution), guess, PRACTICE));
});
