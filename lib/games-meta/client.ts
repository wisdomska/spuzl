"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { DEFAULT_META, type GameMetaRow } from "./index";

/** Library metadata with admin overrides; starts on the defaults so the list never waits. */
export function useGamesMeta(): Record<string, GameMetaRow> {
  const q = useQuery({
    queryKey: ["games-meta"],
    queryFn: () => api<Record<string, GameMetaRow>>("/api/v1/games/meta"),
    staleTime: 10 * 60_000,
    placeholderData: DEFAULT_META,
  });
  return { ...DEFAULT_META, ...(q.data ?? {}) };
}
