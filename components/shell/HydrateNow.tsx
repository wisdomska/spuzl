"use client";

import { hydrate, useQueryClient, type DehydratedState, type QueryKey } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

const noSubscribe = () => () => {};

/**
 * Puts the server's seeded queries into the cache during the first render, before the page reads them, on the
 * server and in the browser alike. React Query's HydrationBoundary does that only for queries not yet in the cache
 * and leaves the rest to an effect. On the server, the app-wide prompts (Inbox's AlertsAsk) render while a seeded
 * page waits for its data and create the game-settings query first, so the server drew the defaults (the live games, no
 * lab game) while the browser drew the seeded data (30): React error #418 on All games in production. `hydrate`
 * only replaces data older than the seed, and React Query tells subscribers later, never during this render.
 *
 * While the page hydrates, the seed wins even over a newer copy: one fetched in the browser before the page hydrated
 * (the route streams in after the app shell) would otherwise draw other values than the server did, #418 again
 * whenever an admin changed a setting in between. That copy is fetched again once the page is up.
 */
export function HydrateNow({ state, children }: { state: DehydratedState; children: ReactNode }) {
  const qc = useQueryClient();
  // true on the server and while hydrating, false in a render on the client (a client-side navigation)
  const hydrating = useSyncExternalStore(
    noSubscribe,
    () => false,
    () => true,
  );
  const [refresh] = useState(() => {
    hydrate(qc, state);
    const newer: QueryKey[] = [];
    if (!hydrating || typeof window === "undefined") return newer;
    for (const q of state.queries) {
      const have = qc.getQueryState(q.queryKey);
      if (have && have.dataUpdatedAt > q.state.dataUpdatedAt && JSON.stringify(have.data) !== JSON.stringify(q.state.data)) {
        qc.setQueryData(q.queryKey, q.state.data, { updatedAt: q.state.dataUpdatedAt });
        newer.push(q.queryKey);
      }
    }
    return newer;
  });
  useEffect(() => {
    for (const key of refresh) void qc.invalidateQueries({ queryKey: key, exact: true });
  }, [qc, refresh]);
  return children;
}
