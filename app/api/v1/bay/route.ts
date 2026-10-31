import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { createBay, inbox } from "@/lib/multiplayer/server/bay";
import { BAY_GAMES } from "@/lib/multiplayer/bay";

const Create = z.object({
  game: z.enum(BAY_GAMES),
  mode: z.enum(["live", "async"]),
  seats: z.number().int().min(2).max(4).optional(),
  rated: z.boolean().optional(),
  bot: z.boolean().optional(),
});

/** GET /api/v1/bay: the "Your move" inbox. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  return ok({ games: await inbox(admin, player.id) });
});

/** POST /api/v1/bay: new Board Bay match (invite link, or the Practice bot). */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `bay-new:${player.id}`, 30, 600);
  return ok(await createBay(admin, player.id, await body(req, Create)));
});
