import { handle, ok } from "@/lib/api/server";
import { loadGamesMeta } from "@/lib/games-meta/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/games/meta: Library duration and filter tags per game (defaults plus admin overrides). */
export const GET = handle(async () =>
  ok(await loadGamesMeta(), { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } }),
);
