import { handle, ok, requirePlayer } from "@/lib/api/server";
import { badgeOverview } from "@/lib/meta/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/badges: badges by family with tiers and progress. Secret badges stay hidden until earned. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const { stats: _s, ...overview } = await badgeOverview(admin, player.id);
  void _s;
  return ok(overview);
});
