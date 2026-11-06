import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { cancelJoinRequest, decideJoinRequest, myJoinRequest } from "@/lib/multiplayer/server/joinRequests";

const Decide = z.object({ decision: z.enum(["approve", "decline"]) });

function idParam(raw: string): string {
  const id = z.uuid().safeParse(raw);
  if (!id.success) throw new ApiError(404, "not_found");
  return id.data;
}

/** GET /api/v1/join-requests/:id: the asker's own request (pending, approved, declined or cancelled). */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/join-requests/[id]">) => {
  const id = idParam((await ctx.params).id);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `join-request-poll:${player.id}`, 120, 60);
  return ok(await myJoinRequest(admin, player.id, id));
});

/** POST /api/v1/join-requests/:id {decision: approve|decline}: the room's current host answers. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/join-requests/[id]">) => {
  const id = idParam((await ctx.params).id);
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `join-request-decide:${player.id}`, 60, 60);
  const { decision } = await body(req, Decide);
  return ok(await decideJoinRequest(admin, player.id, id, decision));
});

/** DELETE /api/v1/join-requests/:id: the asker takes a pending request back. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/v1/join-requests/[id]">) => {
  const id = idParam((await ctx.params).id);
  const { admin, player } = await requirePlayer();
  return ok(await cancelJoinRequest(admin, player.id, id));
});
