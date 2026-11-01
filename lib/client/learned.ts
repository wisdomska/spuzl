"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type Me } from "@/lib/client/api";
import { learnedToSync, markLearned, rememberLearned, learnedGames } from "@/lib/guided";

/** Saves learned games to the account (best effort: the device copy covers a failed call, and syncs later). */
function saveLearned(games: string[]) {
  return api<{ learned: string[] }>("/api/v1/me/learned", { json: { games: games.slice(0, 100) } });
}

/** A guided first play is done (or skipped): remember it here and on the account. */
export function useMarkLearned() {
  const qc = useQueryClient();
  return (id: string) => {
    markLearned(id);
    qc.setQueryData<Me | null>(["me"], (m) => (m ? { ...m, learned: [...new Set([...(m.learned ?? []), id])] } : m));
    saveLearned([id]).catch(() => {});
  };
}

/**
 * Keeps the two copies in step once the account is known: games learned on this device before sign-in (or
 * offline) go up to the account, and the account's come down to this device's cache.
 */
export function useLearnedSync(me: Me | null | undefined) {
  const id = me?.id;
  const account = me?.learned;
  useEffect(() => {
    if (!id || !account) return;
    const up = learnedToSync(learnedGames(), account);
    if (up.length) saveLearned(up).catch(() => {});
    rememberLearned(account);
    // Once per account: later marks go through useMarkLearned.
  }, [id, account === undefined]); // eslint-disable-line react-hooks/exhaustive-deps
}
