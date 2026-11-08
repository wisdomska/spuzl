import { z } from "zod";
import { ApiError, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { startRoom } from "@/lib/multiplayer/server/lobby";
import { codeParam } from "@/lib/multiplayer/server/params";

/** `readyOnly` (R3-01, "Start without them"): start with the ready players; the rest watch this set. */
const Input = z.object({ readyOnly: z.boolean().optional() });

/** POST /api/v1/rooms/:code/start: host starts once everyone is ready (or, asked, with only the ready ones). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/rooms/[code]/start">) => {
  const code = codeParam((await ctx.params).code);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `room-start:${player.id}`, 60, 60);
  // An empty body is the plain Start (older clients send none).
  const raw = (await req.text()).trim();
  let json: unknown = {};
  try {
    if (raw) json = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  const { readyOnly } = Input.parse(json);
  return ok(await startRoom(admin, player.id, code, { readyOnly }));
});
