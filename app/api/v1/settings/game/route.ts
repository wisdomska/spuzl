import { handle, ok } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/settings/game: the runtime game settings (public tunables; edge-cached for a minute). */
export const GET = handle(async () =>
  ok(await getGameSettings(), { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } }),
);
