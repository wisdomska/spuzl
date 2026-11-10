"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, useMe, type Me } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { hasLogic } from "@/games/logic-ids";
import { allLearned, learnedToSync, markLearned, needsGuided, rememberLearned, learnedGames } from "@/lib/guided";

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
 * R4-19: a practice round before the real run of a challenge or a Ghost Race (same rule as solo play: the first try
 * of a game the player doesn't know, unless the admin turned its practice off). `ready`: the account is known, so
 * the answer is final (the screen waits for it before starting anything timed). `finish` is GuidedPlay's onDone.
 */
export function usePracticeFirst(game: string, mode: "challenge" | "ghost") {
  const me = useMe();
  const disabled = useGameSettings()["practice.disabled"];
  const markLearned = useMarkLearned();
  const [done, setDone] = useState(false);
  const needed =
    !done &&
    !!me.data &&
    needsGuided({
      id: game,
      mode,
      played: me.data.played,
      learned: allLearned(learnedGames(), me.data.learned),
      started: false,
      available: hasLogic(game),
      disabled,
    });
  return {
    // A failed profile read never blocks the run: no practice then.
    ready: me.isSuccess || me.isError,
    needed,
    finish: (how: "done" | "skipped" | "unavailable") => {
      if (how !== "unavailable") markLearned(game);
      setDone(true);
    },
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
