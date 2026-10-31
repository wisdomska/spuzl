import { z } from "zod";
import { body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { setReady } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

const Input = z.object({ ready: z.boolean() });

/** POST /api/v1/rooms/:code/ready: ready or not. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/ready">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-ready:${player.id}`, 60, 60);
  return ok(await setReady(admin, player.id, code, (await body(req, Input)).ready));
});
