"use client";

import { api } from "@/lib/client/api";
import { isRetired } from "@/lib/catalog";

/**
 * Hooks for screens outside multiplayer (Results, FR-RS-02): turn a verified clear into a
 * "beat my time" link, and keep a Rage Ridge run as a ghost friends can race.
 */
export async function createChallengeLink(attemptId: string, timeline?: { ms: number; state: unknown }[]): Promise<string> {
  const { code } = await api<{ code: string }>("/api/v1/challenges", { json: { attemptId, timeline } });
  return `${window.location.origin}/challenge/${code}`;
}

/** Rage Ridge games whose runs are kept as ghosts (the server list in lib/multiplayer/server/async.ts), live only. */
export const GHOST_GAMES = ["dash", "flipside", "ghosted"].filter((g) => !isRetired(g));

export async function saveGhostRun(attemptId: string): Promise<string> {
  const { runId } = await api<{ runId: string }>("/api/v1/ghosts", { json: { attemptId } });
  return runId;
}

export const ghostRaceUrl = (game: string, runId?: string) => `/ghost/${game}${runId ? `?run=${runId}` : ""}`;
