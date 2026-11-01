import { handle, ok } from "@/lib/api/server";
import { getGameSettings } from "@/lib/game-settings/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/settings/game: the runtime game settings (public tunables). The edge caches them for a minute; the
 * browser always revalidates, since Chrome honours stale-while-revalidate too and would show an old switch for minutes.
 */
export const GET = handle(async () =>
  ok(await getGameSettings(), {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  }),
);
