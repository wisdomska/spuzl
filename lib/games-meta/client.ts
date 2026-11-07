"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { GameMeta } from "@/lib/catalog";
import { whenQuiet } from "@/lib/perf/quiet";
import { DEFAULT_META, gameCopy, type GameMetaRow } from "./index";

/**
 * Library metadata with admin overrides; starts on the defaults so the list never waits. `quiet`: on a Play screen
 * the request waits until the board is ready (lib/perf/quiet.ts), so it never competes with the first board; a copy
 * already cached (from the Library or a world page) shows at once.
 */
export function useGamesMeta(opts: { quiet?: boolean } = {}): Record<string, GameMetaRow> {
  const q = useQuery({
    queryKey: ["games-meta"],
    queryFn: async () => {
      if (opts.quiet) await whenQuiet();
      return api<Record<string, GameMetaRow>>("/api/v1/games/meta");
    },
    staleTime: 10 * 60_000,
    placeholderData: DEFAULT_META,
  });
  return { ...DEFAULT_META, ...(q.data ?? {}) };
}

/**
 * A game's one-line rule and card copy as players see them (R2-ADMIN): the admin override from the Library page,
 * else the catalog's. Starts on the catalog's copy and fetches quietly, so nothing waits for the request.
 */
export function useGameCopy(meta: Pick<GameMeta, "id" | "rule" | "blurb">): { rule: string; blurb: string } {
  return gameCopy(meta, useGamesMeta({ quiet: true }));
}
