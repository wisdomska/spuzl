import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";
import { blockPlayer, cards } from "@/lib/social/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/blocks: players you blocked (Settings, Privacy). */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { data, error } = await admin.from("blocks").select("blocked_id").eq("player_id", player.id);
  if (error) throw error;
  const people = await cards(
    admin,
    (data ?? []).map((b) => b.blocked_id),
  );
  return ok({ blocked: [...people.values()].map(({ id, nickname, color }) => ({ id, nickname, color })) });
});

const Block = z.object({ playerId: z.uuid() });

/** POST /api/v1/blocks: block a player. Ends any friendship or request between you. */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `block:${player.id}`, 60, 3600);
  const { playerId } = await body(req, Block);
  if (playerId === player.id) throw new ApiError(400, "self");
  await blockPlayer(admin, player.id, playerId);
  return ok({ ok: true });
});
