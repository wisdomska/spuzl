import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { roomSettings } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

const Input = z.object({
  game: z.string().min(2).max(24).nullable().optional(),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
});

/** POST /api/v1/rooms/:code/settings: host changes the game or difficulty in the lobby. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/settings">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-settings:${player.id}`, 60, 60);
  return ok(await roomSettings(admin, player.id, code, await body(req, Input)));
});
