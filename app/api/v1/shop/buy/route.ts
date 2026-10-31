import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

const Buy = z.object({ itemId: z.string().min(1).max(40), requestId: z.uuid() });

const ERRORS: [string, number, string, string][] = [
  ["not enough sparks", 402, "not_enough_sparks", "Not enough Sparks yet."],
  ["unknown_item", 404, "unknown_item", "That item isn't in the Shop."],
  ["locked", 403, "locked", "Reach the level shown to unlock this."],
  ["owned", 409, "owned", "You already own this."],
  ["freeze_full", 409, "freeze_full", "You hold the most Freezes you can."],
];

/**
 * POST /api/v1/shop/buy: spends Sparks through svc_spend_sparks inside svc_buy_cosmetic (one transaction).
 * `requestId` makes a retried purchase free: the second call returns "duplicate" and charges nothing.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `shop:${player.id}`, 60, 3600);
  const { itemId, requestId } = await body(req, Buy);
  const { data, error } = await admin.rpc("svc_buy_cosmetic", { p_player: player.id, p_item: itemId, p_request: requestId });
  if (error) {
    const hit = ERRORS.find(([needle]) => error.message?.includes(needle));
    if (hit) throw new ApiError(hit[1], hit[2], hit[3]);
    throw error;
  }
  const res = data as { status: "bought" | "duplicate"; sparks: number };
  return ok({ ok: true, status: res.status, balance: Number(res.sparks) });
});
