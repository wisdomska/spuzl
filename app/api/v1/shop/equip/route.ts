import { z } from "zod";
import { ApiError, body, handle, ok, rateLimit, requirePlayer } from "@/lib/api/server";

const Equip = z.object({ itemId: z.string().min(1).max(40), equip: z.boolean() });

/**
 * POST /api/v1/shop/equip: wear or take off an owned item. One item per type.
 * Skins also set the avatar colour, hats and titles show on your profile and boards.
 */
export const POST = handle(async (req: Request) => {
  const { admin, player } = await requirePlayer();
  await rateLimit(admin, `equip:${player.id}`, 120, 3600);
  const { itemId, equip } = await body(req, Equip);
  const { data: item } = await admin.from("cosmetics").select("id, type, name, payload").eq("id", itemId).maybeSingle();
  if (!item || item.type === "freeze" || item.type === "hint_pack") throw new ApiError(404, "unknown_item");
  const { data: own } = await admin
    .from("inventory")
    .select("cosmetic_id")
    .eq("player_id", player.id)
    .eq("cosmetic_id", itemId)
    .maybeSingle();
  if (!own) throw new ApiError(403, "not_owned", "Buy it first.");

  const { data: sameType } = await admin.from("cosmetics").select("id").eq("type", item.type);
  const ids = (sameType ?? []).map((c) => c.id);
  const { error: e1 } = await admin.from("inventory").update({ equipped: false }).eq("player_id", player.id).in("cosmetic_id", ids);
  if (e1) throw e1;
  if (equip) {
    const { error: e2 } = await admin.from("inventory").update({ equipped: true }).eq("player_id", player.id).eq("cosmetic_id", itemId);
    if (e2) throw e2;
  }
  const payload = (item.payload ?? {}) as Record<string, string>;
  const patch: Record<string, string | null> = {};
  if (item.type === "skin") {
    patch.skin = equip ? item.id : null;
    if (equip && /^#[0-9A-Fa-f]{6}$/.test(payload.color ?? "")) patch.avatar_color = payload.color;
  }
  if (item.type === "hat") patch.hat = equip ? (payload.hat ?? item.id) : null;
  if (item.type === "title") patch.title = equip ? item.name : null;
  if (Object.keys(patch).length) {
    const { error } = await admin.from("players").update(patch).eq("id", player.id);
    if (error) throw error;
  }
  return ok({ ok: true });
});
