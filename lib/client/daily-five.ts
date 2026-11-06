"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { isFinished } from "@/lib/daily-five";
import type { DailyFiveView, FiveGame } from "@/lib/daily-five/server";

export type { DailyFiveView, FiveGame };

/** Today's Daily Five and this player's progress (GET /api/v1/daily-five). Home and /daily seed it on the server. */
export function useDailyFive(enabled = true) {
  return useQuery({
    queryKey: ["daily-five"],
    queryFn: () => api<DailyFiveView>("/api/v1/daily-five"),
    staleTime: 15_000,
    enabled,
  });
}

/** The Play link for a Daily Five game. */
export const fiveHref = (game: string) => `/play/${game}?mode=five`;

/** The first game of the five not played yet (null when all five are done). */
export function nextFiveGame(v: Pick<DailyFiveView, "games"> | null | undefined): FiveGame | null {
  return v?.games.find((g) => !isFinished(g.state)) ?? null;
}

/**
 * Shares the grid with the Web Share API (WhatsApp, Snap, X from the phone's sheet), or copies it when the
 * browser has no share sheet or sharing fails. "cancelled" when the player closed the sheet.
 */
export async function shareFiveGrid(text: string, title: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
      /* no share target: fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
