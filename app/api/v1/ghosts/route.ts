import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { saveGhostRun } from "@/lib/multiplayer/server/async";

const Save = z.object({ attemptId: z.string().uuid() });

/** POST /api/v1/ghosts: keep a verified Rage Ridge run as a ghost friends can race. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `ghost-save:${player.id}`, 30, 600);
  return ok(await saveGhostRun(admin, player.id, (await body(req, Save)).attemptId));
});
