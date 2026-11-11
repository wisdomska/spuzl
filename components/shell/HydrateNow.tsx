"use client";

import { hydrate, useQueryClient, type DehydratedState } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Puts the server's seeded queries into the cache during the first render, before the page reads them, on the
 * server and in the browser alike. React Query's HydrationBoundary does that only for queries not yet in the cache
 * and leaves the rest to an effect. On the server, the app-wide prompts (Inbox's AlertsAsk) render while a seeded
 * page waits for its data and create the game-settings query first, so the server drew the defaults (the live games, no
 * lab game) while the browser drew the seeded data (30): React error #418 on All games in production. `hydrate`
 * only replaces data older than the seed, and React Query tells subscribers later, never during this render.
 */
export function HydrateNow({ state, children }: { state: DehydratedState; children: ReactNode }) {
  const qc = useQueryClient();
  useState(() => {
    hydrate(qc, state);
    return true;
  });
  return children;
}
