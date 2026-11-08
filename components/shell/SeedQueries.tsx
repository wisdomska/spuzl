import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getGameSettings } from "@/lib/game-settings/server";
import { loadGamesMeta } from "@/lib/games-meta/server";

/**
 * Seeds the client's game settings and game meta (durations, tags, lab switches) from the server, so the server
 * render and the first client render use the same values: no flash of default durations or missing lab games,
 * and no hydration mismatch. Both are public (the same as GET /api/v1/settings/game and /api/v1/games/meta) and
 * cached for 30 s per server instance. Wraps only pages that already render per request.
 */
export async function SeedQueries({ children }: { children: ReactNode }) {
  const [settings, meta] = await Promise.all([getGameSettings(), loadGamesMeta()]);
  const qc = new QueryClient();
  qc.setQueryData(["game-settings"], settings);
  qc.setQueryData(["games-meta"], meta);
  return <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>;
}
