"use client";

import { useQuery } from "@tanstack/react-query";
import { isLadderGame } from "@/lib/game/levels";
import { api } from "./api";

export interface LadderSummary {
  /** highest verified clear, 0 when none */
  top: number;
  /** the level to play next */
  next: number;
  /** ladder size, null when endless */
  levels: number | null;
}

export interface LadderDetail extends LadderSummary {
  game: string;
  cleared: { level: number; bestMs: number }[];
}

/** Level progress for every ladder game (game cards). Kept with the account, so guests keep it too. */
export function useLevels(enabled = true) {
  return useQuery({
    queryKey: ["levels"],
    enabled,
    staleTime: 30_000,
    queryFn: () => api<{ games: Record<string, LadderSummary> }>("/api/v1/levels"),
  });
}

/** One game's cleared levels and best times (the level list sheet). */
export function useGameLevels(game: string | null, enabled = true) {
  return useQuery({
    queryKey: ["levels", game],
    enabled: enabled && !!game && isLadderGame(game),
    staleTime: 10_000,
    queryFn: () => api<LadderDetail>(`/api/v1/levels?game=${encodeURIComponent(game!)}`),
  });
}

/** Play URL for a level (no number: the player's next level). */
export const levelHref = (game: string, n?: number) => `/play/${game}?mode=level${n ? `&level=${n}` : ""}`;
