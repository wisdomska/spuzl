"use client";

import { api } from "@/lib/client/api";

/**
 * Hooks for screens outside multiplayer (Results, FR-RS-02): turn a verified clear into a
 * "beat my time" link, and keep a Rage Ridge run as a ghost friends can race.
 */
export async function createChallengeLink(attemptId: string, timeline?: { ms: number; state: unknown }[]): Promise<string> {
  const { code } = await api<{ code: string }>("/api/v1/challenges", { json: { attemptId, timeline } });
  return `${window.location.origin}/challenge/${code}`;
}

export const GHOST_GAMES = ["dash", "flipside", "ghosted"];

export async function saveGhostRun(attemptId: string): Promise<string> {
  const { runId } = await api<{ runId: string }>("/api/v1/ghosts", { json: { attemptId } });
  return runId;
}

export const ghostRaceUrl = (game: string, runId?: string) => `/ghost/${game}${runId ? `?run=${runId}` : ""}`;
