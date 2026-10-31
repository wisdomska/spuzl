import { handle, ok, requirePlayer } from "@/lib/api/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/shop: the catalogue with your inventory, wallet, Freezes held and hint packs. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const [{ data: items, error }, { data: inv }, { data: streak }, { data: me }] = await Promise.all([
    admin
      .from("cosmetics")
      .select("id, type, name, price_sparks, rarity, payload, unlock_level, sort")
      .eq("active", true)
      .order("sort")
      .order("price_sparks"),
    admin.from("inventory").select("cosmetic_id, equipped").eq("player_id", player.id),
    admin.from("streaks").select("freezes_held").eq("player_id", player.id).maybeSingle(),
    admin.from("players").select("sparks, level, practice_hints, avatar_color, skin, hat, title").eq("id", player.id).single(),
  ]);
  if (error) throw error;
  const owned = new Map((inv ?? []).map((i) => [i.cosmetic_id as string, i.equipped as boolean]));
  return ok({
    sparks: me?.sparks ?? player.sparks,
    level: me?.level ?? player.level,
    freezesHeld: streak?.freezes_held ?? 0,
    practiceHints: me?.practice_hints ?? 0,
    wearing: { color: me?.avatar_color, skin: me?.skin ?? null, hat: me?.hat ?? null, title: me?.title ?? null },
    items: (items ?? []).map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      price: i.price_sparks,
      rarity: i.rarity,
      payload: i.payload ?? {},
      unlockLevel: i.unlock_level,
      owned: owned.has(i.id),
      equipped: owned.get(i.id) ?? false,
    })),
  });
});
