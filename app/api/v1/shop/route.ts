import { handle, ok, requirePlayer } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";
import { isStarter } from "@/lib/gamification/cosmetics";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/shop: the catalogue with your inventory, wallet, Freezes held and hint packs.
 * Starter items come first and show the live `shop.starterPrice` (the same price /shop/buy charges).
 */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const [{ data: items, error }, { data: inv }, { data: streak }, { data: me }, settings] = await Promise.all([
    admin
      .from("cosmetics")
      .select("id, type, name, price_sparks, rarity, payload, unlock_level, sort")
      .eq("active", true)
      .order("sort")
      .order("price_sparks"),
    admin.from("inventory").select("cosmetic_id, equipped").eq("player_id", player.id),
    admin.from("streaks").select("freezes_held").eq("player_id", player.id).maybeSingle(),
    admin.from("players").select("sparks, level, practice_hints, avatar_color, skin, hat, title").eq("id", player.id).single(),
    getGameSettings(),
  ]);
  if (error) throw error;
  const owned = new Map((inv ?? []).map((i) => [i.cosmetic_id as string, i.equipped as boolean]));
  const rows = (items ?? []).map((i) => ({ ...i, payload: (i.payload ?? {}) as Record<string, string | number> }));
  // Stable sort: starter items first, the rest keep the database order.
  rows.sort((a, b) => Number(isStarter(b)) - Number(isStarter(a)));
  return ok({
    sparks: me?.sparks ?? player.sparks,
    level: me?.level ?? player.level,
    freezesHeld: streak?.freezes_held ?? 0,
    practiceHints: me?.practice_hints ?? 0,
    wearing: { color: me?.avatar_color, skin: me?.skin ?? null, hat: me?.hat ?? null, title: me?.title ?? null },
    items: rows.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      price: isStarter(i) ? settings["shop.starterPrice"] : i.price_sparks,
      rarity: i.rarity,
      payload: i.payload,
      starter: isStarter(i),
      unlockLevel: i.unlock_level,
      owned: owned.has(i.id),
      equipped: owned.get(i.id) ?? false,
    })),
  });
});
