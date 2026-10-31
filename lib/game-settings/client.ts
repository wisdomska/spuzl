"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { DEFAULTS, type GameSettings } from "./schema";

/** Runtime game settings for the client. Starts on the defaults, so nothing waits on the fetch. */
export function useGameSettings(): GameSettings {
  const q = useQuery({
    queryKey: ["game-settings"],
    queryFn: () => api<GameSettings>("/api/v1/settings/game"),
    staleTime: 5 * 60_000,
    placeholderData: DEFAULTS,
  });
  return { ...DEFAULTS, ...(q.data ?? {}) };
}
