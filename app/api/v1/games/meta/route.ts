import { handle, ok } from "@/lib/api/server";
import { loadGamesMeta } from "@/lib/games-meta/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/games/meta: Library duration and filter tags per game (defaults plus admin overrides). */
export const GET = handle(async () =>
  ok(await loadGamesMeta(), {
    // Edge-cached; the browser revalidates (Chrome would otherwise serve admin edits stale for up to an hour).
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  }),
);
